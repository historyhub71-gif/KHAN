export const DateHelpers = {
  parseDate: (date: string | Date) => {
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(date);
  },

  formatDate: (date: string | Date) => {
    const d = DateHelpers.parseDate(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  },

  formatDateShort: (date: string | Date) => {
    const d = DateHelpers.parseDate(date);
    return d.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
    });
  },

  getMonthYear: (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  },

  getDaysInMonth: (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  },

  getFirstDayOfMonth: (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  },

  isToday: (date: string | Date) => {
    const today = new Date();
    const d = DateHelpers.parseDate(date);
    return d.toDateString() === today.toDateString();
  },

  isFutureDate: (date: string | Date) => {
    const today = new Date();
    const d = DateHelpers.parseDate(date);
    d.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return d > today;
  },

  formatISO: (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  getWeekDays: () => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],

  getMonths: () => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ],

  getDayName: (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  },

  addMonths: (date: Date, months: number) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  },

  subtractMonths: (date: Date, months: number) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() - months);
    return d;
  },
};
