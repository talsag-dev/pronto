const CAL_API_KEY = process.env.CAL_API_KEY;

export async function checkAvailability(startTime: string, endTime: string, apiKey: string): Promise<string[]> {
  // Real implementation:
  // const res = await fetch(`https://api.cal.com/v1/availability?apiKey=${apiKey}...`);
  // For MVP, we mock it, but signature is ready.
  console.log(`[Cal.com] Checking availability with token: ${apiKey.substring(0, 5)}...`);
  return ["10:00", "14:00", "16:00"];
}

export async function bookMeeting(time: string, email: string, name: string, apiKey: string): Promise<boolean> {
  // Real implementation:
  // POST https://api.cal.com/v1/bookings?apiKey=${apiKey}
  console.log(`[Cal.com] Booking meeting at ${time} for ${name} using token: ${apiKey.substring(0, 5)}...`);
  return true;
}
