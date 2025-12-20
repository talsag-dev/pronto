import { openai } from './config';
import fs from 'fs';

/**
 * Transcribes an audio file using OpenAI Whisper.
 * @param filePath Absolute path to the audio file.
 * @returns Transcribed text.
 */
export async function transcribeAudio(filePath: string): Promise<string> {
  try {
    const translation = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
    });
    return translation.text;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
}
