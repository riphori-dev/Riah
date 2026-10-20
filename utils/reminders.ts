export interface Reminder {
  id: string;
  at: number;
  title: string;
  body: string;
  screen: string;
}
/** Calendar-day offsets preserve the appointment's local wall time across DST. */
export function appointmentReminders(
  appointments: { id: number; date: number; title: string }[],
  now = Date.now(),
): Reminder[] {
  return appointments
    .flatMap((appointment) =>
      [7, 3, 1, 0].map((days) => {
        const at = new Date(appointment.date);
        if (days) at.setDate(at.getDate() - days);
        else at.setHours(at.getHours() - 1);
        return {
          id: `riah-appointment-${appointment.id}-${days}`,
          at: at.getTime(),
          screen: '/appointments',
          title: days
            ? `Appointment in ${days} day${days === 1 ? '' : 's'}`
            : 'Appointment in 1 hour',
          body: `${appointment.title} · ${new Date(appointment.date).toLocaleString()}`,
        };
      }),
    )
    .filter((reminder) => reminder.at > now)
    .sort((a, b) => a.at - b.at);
}
