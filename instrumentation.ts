export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeWhatsAppListeners } = await import('@/lib/services/message-handler');
    await initializeWhatsAppListeners();
  }
}
