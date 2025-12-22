import { 
    AuthenticationCreds, 
    AuthenticationState, 
    SignalDataTypeMap, 
    initAuthCreds, 
    BufferJSON, 
    proto 
} from '@whiskeysockets/baileys';
import { supabaseAdmin } from './supabase';

// We need to handle Buffer serialization/deserialization
const initData = (data: any) => {
    return JSON.parse(JSON.stringify(data), BufferJSON.reviver);
}

export const useSupabaseAuthState = async (sessionId: string): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> => {
    // 1. Fetch all existing data for this session
    const { data: rows, error } = await supabaseAdmin
        .from('whatsapp_sessions')
        .select('*')
        .eq('session_id', sessionId);

    if (error) {
        throw new Error(`Failed to fetch session data: ${error.message}`);
    }

    // 2. Organize data into a key-value map
    const data: any = {};
    rows?.forEach((row: any) => {
        try {
            data[row.key] = JSON.parse(row.value, BufferJSON.reviver);
        } catch (e) {
            console.error(`Failed to parse session data for key ${row.key}`, e);
        }
    });

    const creds: AuthenticationCreds = data.creds || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const result: any = {};
                    for (const id of ids) {
                        const key = `${type}-${id}`;
                        if (data[key]) {
                            result[id] = data[key];
                        }
                    }
                    return result;
                },
                set: async (dataToSet) => {
                    const updates: { session_id: string, key: string, value: string }[] = [];
                    
                    for (const category in dataToSet) {
                        for (const id in dataToSet[category as keyof SignalDataTypeMap]) {
                            const value = dataToSet[category as keyof SignalDataTypeMap]![id];
                            const key = `${category}-${id}`;
                            
                            // Update local cache
                            data[key] = value;
                            
                            if (value) {
                             updates.push({
                                session_id: sessionId,
                                key,
                                value: JSON.stringify(value, BufferJSON.replacer)
                             })
                            } else {
                                await supabaseAdmin
                                    .from('whatsapp_sessions')
                                    .delete()
                                    .match({ session_id: sessionId, key });
                            }
                        }
                    }

                    if (updates.length > 0) {
                        const { error } = await supabaseAdmin
                            .from('whatsapp_sessions')
                            .upsert(updates, { onConflict: 'session_id,key' as any });
                        
                        if (error) {
                            console.error('Failed to save auth state:', error);
                        }
                    }
                }
            }
        },
        saveCreds: async () => {
            const { error } = await supabaseAdmin
                .from('whatsapp_sessions')
                .upsert({
                    session_id: sessionId,
                    key: 'creds',
                    value: JSON.stringify(creds, BufferJSON.replacer)
                }, { onConflict: 'session_id,key' as any });
                
            if (error) {
                console.error('Failed to save creds:', error);
            }
        }
    };
};
