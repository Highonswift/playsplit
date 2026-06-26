import type { GroupDashboardData } from '@/components/dashboard';

/** Seeded demo dashboard data (mirrors the PRD §16 example figures). */
export const DEMO_DASHBOARD: GroupDashboardData = {
  groupName: 'Saturday Cricket',
  sport: 'cricket',
  subscription: {
    name: 'July Subscription',
    status: 'yellow',
    remainingHours: 9,
    daysRemaining: 8,
    purchasedHours: 20,
  },
  upcomingMatches: [
    { id: '1', date: 'Sat, 28 Jun · 6:00 AM', ground: 'Greenfield Turf', rsvps: 11 },
    { id: '2', date: 'Sun, 29 Jun · 7:00 AM', ground: 'Greenfield Turf', rsvps: 8 },
  ],
  pendingPaymentsPaise: 245000, // ₹2,450
  collectionRatePct: 92,
  attendancePct: 78,
  savingsPaise: 320000, // ₹3,200
};
