import mongoose from 'mongoose';
import { Activity, Team, User, Workout } from '../models/index.js';

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  const body = (input && typeof input === 'object' ? input as Record<string, unknown> : {});
  const userId = typeof body.userId === 'string' ? body.userId : body.userId ? String(body.userId) : '';
  const teamId = typeof body.teamId === 'string' ? body.teamId : body.teamId ? String(body.teamId) : '';
  const type = typeof body.type === 'string' ? body.type.trim() : '';
  const minutes = Number(body.minutes);

  if (!userId || !teamId || !type || !Number.isFinite(minutes) || minutes <= 0) {
    throw Object.assign(new Error('Activity validation failed'), { status: 400 });
  }

  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(teamId)) {
    throw Object.assign(new Error('Activity validation failed'), { status: 400 });
  }

  const [user, team] = await Promise.all([
    User.findById(userId),
    Team.findById(teamId),
  ]);

  if (!user || !team) {
    throw Object.assign(new Error('Activity validation failed'), { status: 400 });
  }

  const activity = await Activity.create({
    user: user._id,
    team: team._id,
    type,
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });

  return activity.toObject();
}

export async function listTeams() {
  const teams = await Team.find().lean();
  return teams.map((team) => ({
    ...team,
    members: (team.members ?? []).map((member) => member.toString()),
  }));
}

export async function createTeam(input: unknown) {
  const body = (input && typeof input === 'object' ? input as Record<string, unknown> : {});
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const mascot = typeof body.mascot === 'string' ? body.mascot.trim() : '';
  const membersInput = Array.isArray(body.members) ? body.members : [];

  if (!name || !mascot) {
    throw Object.assign(new Error('Team validation failed'), { status: 400 });
  }

  const members = membersInput.flatMap((member) => {
    const value = typeof member === 'string' ? member : member && typeof member === 'object' && '_id' in member ? String((member as { _id?: unknown })._id ?? '') : '';
    return mongoose.isValidObjectId(value) ? [new mongoose.Types.ObjectId(value)] : [];
  });

  const team = await Team.create({
    name,
    mascot,
    members,
  });

  return {
    ...team.toObject(),
    members: team.members.map((member) => member.toString()),
  };
}

export async function getLeaderboard() {
  const leaderboard = await Activity.aggregate([
    { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
    { $sort: { totalPoints: -1, _id: 1 } },
    {
      $lookup: {
        from: 'teams',
        localField: '_id',
        foreignField: '_id',
        as: 'team',
      },
    },
    { $unwind: '$team' },
    {
      $project: {
        _id: 0,
        teamName: '$team.name',
        totalPoints: 1,
      },
    },
  ]);

  return leaderboard.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail.toLowerCase() }).lean();
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const recentActivity = await Activity.find({ user: user._id }).sort({ occurredAt: -1 }).limit(3).lean();
  const recentType = typeof recentActivity[0]?.type === 'string' ? recentActivity[0].type.toLowerCase() : '';
  const userGoal = typeof user.fitnessGoal === 'string' ? user.fitnessGoal.toLowerCase() : '';
  const typeFocusMap: Record<string, string> = {
    run: 'endurance',
    cycle: 'endurance',
    walk: 'mobility',
    strength: 'strength',
    sprint: 'endurance',
    yoga: 'mobility',
    stretch: 'mobility',
  };
  const focusHints = Array.from(new Set([
    userGoal,
    recentType,
    typeFocusMap[recentType] ?? '',
  ].filter(Boolean)));

  const entireCatalog = await Workout.find().lean();
  const prioritized = [...entireCatalog].sort((a, b) => {
    const scoreA = Number(
      (a.focus && focusHints.includes(String(a.focus).toLowerCase())) ||
      (a.title && focusHints.some((hint) => String(a.title).toLowerCase().includes(hint)))
    );
    const scoreB = Number(
      (b.focus && focusHints.includes(String(b.focus).toLowerCase())) ||
      (b.title && focusHints.some((hint) => String(b.title).toLowerCase().includes(hint)))
    );
    return scoreB - scoreA;
  });

  return prioritized.slice(0, 3).map((workout) => {
    const matchedFocus = focusHints.find((hint) => {
      const focus = String(workout.focus ?? '').toLowerCase();
      return focus.includes(hint) || String(workout.title ?? '').toLowerCase().includes(hint);
    }) ?? (userGoal || recentType || 'fitness');

    return {
      ...workout,
      reason: `Matches your recent ${recentType || userGoal || 'activity'} pattern and supports your ${matchedFocus} goal.`,
    };
  });
}

export { User };
