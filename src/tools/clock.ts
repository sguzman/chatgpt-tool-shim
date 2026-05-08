export async function clock() {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    time: new Intl.DateTimeFormat(undefined, {
      dateStyle: "full",
      timeStyle: "long",
      timeZone: timezone
    }).format(now),
    timezone,
    iso: now.toISOString()
  };
}
