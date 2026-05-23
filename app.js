/**
 * MINDPULSE — Adaptive Habit Engine
 * Core Logic File (app.js)
 * Structured in Conceptual Layers:
 * 1. DATA LAYER: LocalStorage storage, seeding, retrieval.
 * 2. INTELLIGENCE LAYER: Math for scores, risks, insights, and trends.
 * 3. ADAPTATION LAYER: Feedback-based learning & weights.
 * 4. PRESENTATION LAYER: UI triggers, progress ring, Chart.js rendering, loading screens.
 */

// ==========================================
// 1. DATA LAYER
// ==========================================

const DATA_KEY = 'mindpulse_entries';
const FEEDBACK_KEY = 'mindpulse_feedback_weights';

/**
 * Get all check-in entries from localStorage
 */
function getEntries() {
  const data = localStorage.getItem(DATA_KEY);
  return data ? JSON.parse(data) : [];
}

/**
 * Save a new check-in entry
 */
function saveEntry(entry) {
  const entries = getEntries();
  entries.push(entry);
  localStorage.setItem(DATA_KEY, JSON.stringify(entries));
}

/**
 * Clear entries (useful for resets)
 */
function clearEntries() {
  localStorage.removeItem(DATA_KEY);
}

/**
 * Get feedback weights from localStorage
 */
function getFeedbackWeights() {
  const data = localStorage.getItem(FEEDBACK_KEY);
  if (data) {
    return JSON.parse(data);
  }
  // Default weights for each category
  return {
    sleep: 1.0,
    stress: 1.0,
    screentime: 1.0,
    exercise: 1.0,
    mood: 1.0
  };
}

/**
 * Update the weight of a recommendation category based on user feedback
 */
function updateFeedbackWeight(category, isHelpful) {
  const weights = getFeedbackWeights();
  if (isHelpful) {
    weights[category] = Math.min((weights[category] || 1.0) + 0.5, 3.0);
  } else {
    weights[category] = Math.max((weights[category] || 1.0) - 0.5, 0.2); // floor at 0.2
  }
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(weights));
}

/**
 * Seeds baseline data if history has less than 7 entries
 * Baseline data represents realistic historical behavior
 */
function getSmartSeededHistory() {
  const actualEntries = getEntries();
  
  if (actualEntries.length >= 7) {
    return actualEntries.slice(-7);
  }

  // Create seed data for the remaining days
  const seedCount = 7 - actualEntries.length;
  const history = [];
  const now = new Date();

  // Baseline seed values (healthy to slightly fatigued baseline estimates)
  // We'll generate realistic, slightly varying values to look organic
  const baselineData = [
    { sleep: 7.0, stress: 4, mood: 4, screenTime: 4.5, exercise: 30 },
    { sleep: 6.5, stress: 5, mood: 3, screenTime: 5.0, exercise: 20 },
    { sleep: 7.5, stress: 3, mood: 4, screenTime: 3.5, exercise: 45 },
    { sleep: 6.0, stress: 6, mood: 3, screenTime: 6.0, exercise: 15 },
    { sleep: 8.0, stress: 2, mood: 5, screenTime: 3.0, exercise: 60 },
    { sleep: 5.5, stress: 7, mood: 2, screenTime: 7.0, exercise: 10 },
    { sleep: 7.0, stress: 4, mood: 4, screenTime: 4.0, exercise: 30 }
  ];

  for (let i = 0; i < seedCount; i++) {
    const seedDate = new Date();
    seedDate.setDate(now.getDate() - (7 - i));
    
    const seedVal = baselineData[i % baselineData.length];
    
    history.push({
      timestamp: seedDate.getTime(),
      isBaseline: true,
      sleep: seedVal.sleep,
      stress: seedVal.stress,
      mood: seedVal.mood,
      screenTime: seedVal.screenTime,
      exercise: seedVal.exercise
    });
  }

  // Append actual user entries
  actualEntries.forEach((entry, index) => {
    const entryDate = new Date();
    entryDate.setDate(now.getDate() - (actualEntries.length - 1 - index));
    entry.timestamp = entryDate.getTime();
    history.push(entry);
  });

  return history;
}


// ==========================================
// 2. INTELLIGENCE LAYER
// ==========================================

/**
 * Calculates Recovery Score (0 - 100)
 */
function calculateRecoveryScore(entry) {
  // Sleep points: Optimal is 8h, cap at 100 points
  const sleepPoints = Math.min((entry.sleep / 8) * 100, 100);
  
  // Mood points: Scale 1-5 to 0-100 (1 -> 20, 5 -> 100)
  const moodPoints = (entry.mood / 5) * 100;
  
  // Exercise points: Optimal is 30m+, cap at 100 points
  const exercisePoints = Math.min((entry.exercise / 30) * 100, 100);
  
  // Stress points: Scale 1-10 to 100-0 (1 -> 100, 10 -> 0)
  const stressPoints = (10 - entry.stress) * 11.11; // 10 is 0 points, 1 is 100 points (approx)
  
  // Screen time points: 0h is 100, 8h+ is 0 points
  const screenTimePoints = Math.max((8 - entry.screenTime) / 8 * 100, 0);

  // Apply Weights
  // Sleep (40%), Mood (25%), Stress (15%), Exercise (15%), Screen Time (5%)
  const score = (sleepPoints * 0.40) + 
                (moodPoints * 0.25) + 
                (stressPoints * 0.15) + 
                (exercisePoints * 0.15) + 
                (screenTimePoints * 0.05);

  return Math.round(Math.min(Math.max(score, 0), 100));
}

/**
 * Classifies score threshold
 */
function getScoreThreshold(score) {
  if (score >= 65) return { label: 'Strong', color: 'text-emerald-400', stroke: '#10b981' };
  if (score >= 40) return { label: 'Moderate', color: 'text-amber-400', stroke: '#f59e0b' };
  return { label: 'Critical', color: 'text-rose-500', stroke: '#f43f5e' };
}

/**
 * Calculates burnout risk level
 */
function getBurnoutRisk(entry) {
  // High risk conditions
  if (entry.sleep < 5 && entry.stress > 7) {
    return {
      level: 'Elevated Burnout Risk',
      icon: 'alert-triangle',
      color: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
      explanation: 'Your combination of severe sleep deprivation and high stress signals immediate risk of exhaustion.'
    };
  }
  
  // Moderate risk conditions
  if ((entry.sleep < 6 && entry.stress > 5) || (entry.mood <= 2 && entry.stress > 6)) {
    return {
      level: 'Moderate Burnout Signals',
      icon: 'alert-circle',
      color: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
      explanation: 'Elevated stress and low mood are impacting your vitality. Active recovery steps recommended.'
    };
  }
  
  // Low risk / Stable conditions
  return {
    level: 'Stable Condition',
    icon: 'circle-check',
    color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    explanation: 'Your behavioral indicators suggest a balanced state. Keep prioritizing rest and boundaries.'
  };
}

/**
 * Detect multi-day patterns and trends (compares current entry vs last 3 entries)
 */
function analyzeBehavioralInsights() {
  const actualEntries = getEntries();
  if (actualEntries.length === 0) {
    return {
      insights: [{icon: 'info', text: "No behavioral patterns detected yet. Complete more check-ins to build behavioral history."}],
      trendMessage: "Baseline behavioral estimate (insufficient data).",
      trendIcon: "minus",
      trendColor: "text-slate-400"
    };
  }

  const latest = actualEntries[actualEntries.length - 1];
  
  // We look at the last 3 entries including the latest one.
  const last3 = actualEntries.slice(-3);
  const count = last3.length;

  const insights = [];

  // 1. Detect patterns in the last 3 entries
  if (count >= 2) {
    const sleepAvg = last3.reduce((sum, e) => sum + e.sleep, 0) / count;
    const stressAvg = last3.reduce((sum, e) => sum + e.stress, 0) / count;
    const moodAvg = last3.reduce((sum, e) => sum + e.mood, 0) / count;
    const screenAvg = last3.reduce((sum, e) => sum + e.screenTime, 0) / count;

    if (sleepAvg < 5.5) {
      insights.push({icon: 'brain', text: "Sleep deficit trend detected over the last few check-ins, which strongly reduces recovery resilience."});
    }
    if (stressAvg > 7) {
      insights.push({icon: 'alert-triangle', text: "Consistent high-stress indicators suggest risk of cognitive and emotional overload."});
    }
    if (moodAvg <= 2) {
      insights.push({icon: 'heart-pulse', text: "Muted mood indicators suggest persistent energy fatigue or emotional wear."});
    }
    if (count === 3 && last3[2].screenTime > last3[1].screenTime && last3[1].screenTime > last3[0].screenTime) {
      insights.push({icon: 'smartphone', text: "Digital exposure is trending upward daily, adding to mental fatigue."});
    }
  }

  // Default fallback if no severe patterns are caught
  if (insights.length === 0) {
    insights.push({icon: 'sparkles', text: "Behavioral baseline stable. Your indicators show consistency in sleep and workload balance."});
  }

  // 2. Trend analysis (Comparing latest entry against the average of previous 1-3 entries)
  let trendMessage = "Stable behavior patterns detected.";
  let trendIcon = "minus";
  let trendColor = "text-emerald-400";

  if (actualEntries.length > 1) {
    const previousEntries = actualEntries.slice(0, -1).slice(-3);
    const prevScoreAvg = previousEntries.reduce((sum, e) => sum + calculateRecoveryScore(e), 0) / previousEntries.length;
    const latestScore = calculateRecoveryScore(latest);
    const diff = latestScore - prevScoreAvg;

    if (diff > 5) {
      trendMessage = `Recovery trend is improving (+${Math.round(diff)} points) compared to your recent baseline.`;
      trendIcon = "trending-up";
      trendColor = "text-emerald-400";
    } else if (diff < -5) {
      trendMessage = `Recovery metrics are declining (${Math.round(diff)} points) compared to your recent baseline.`;
      trendIcon = "trending-down";
      trendColor = "text-rose-400";
    } else {
      trendMessage = "Recovery levels remain stable and consistent with your weekly baseline.";
      trendIcon = "equal";
      trendColor = "text-slate-300";
    }
  }

  return { insights, trendMessage, trendIcon, trendColor };
}


// ==========================================
// 3. ADAPTATION LAYER
// ==========================================

/**
 * Evaluates breached thresholds and ranks them based on user feedback weights
 */
function getAdaptiveRecommendation(entry) {
  const weights = getFeedbackWeights();

  // Define recommendations list with base priorities
  const options = [
    {
      category: 'sleep',
      condition: entry.sleep < 6,
      text: "Sleep deficit flagged. Target 7.5+ hours tonight and limit screens before bed.",
      basePriority: 5
    },
    {
      category: 'stress',
      condition: entry.stress > 6,
      text: "Elevated stress detected. Schedule 10 minutes of structured breathing or offline walk.",
      basePriority: 4
    },
    {
      category: 'screentime',
      condition: entry.screenTime > 5,
      text: "High digital load. Set a 1-hour screen-free window prior to sleep.",
      basePriority: 3
    },
    {
      category: 'exercise',
      condition: entry.exercise < 20,
      text: "Low physical movement. A brief 15-minute stretching routine or walk will boost recovery score.",
      basePriority: 2
    },
    {
      category: 'mood',
      condition: entry.mood <= 2,
      text: "Low mood signal. Step away from work or chat with a close friend to reset.",
      basePriority: 1
    }
  ];

  // Calculate adjusted priority for active (breached) recommendations
  const activeRecs = options.filter(opt => opt.condition);

  if (activeRecs.length === 0) {
    return {
      category: 'stable',
      text: "Your behavioral patterns are stable. Maintain current routine and pacing.",
      weight: 1.0
    };
  }

  // Rank by basePriority * category feedback weight
  activeRecs.forEach(rec => {
    const weight = weights[rec.category] || 1.0;
    rec.adjustedPriority = rec.basePriority * weight;
  });

  // Sort descending by adjusted priority
  activeRecs.sort((a, b) => b.adjustedPriority - a.adjustedPriority);

  return {
    category: activeRecs[0].category,
    text: activeRecs[0].text,
    weight: weights[activeRecs[0].category] || 1.0
  };
}


// ==========================================
// 4. REPORTS LAYER
// ==========================================

/**
 * Generates a comprehensive behavioral intelligence report for a given period.
 * @param {'weekly'|'monthly'|'yearly'} period
 * @returns {object|null} Report data or null if no entries exist
 */
function generateReport(period) {
  const entries = getEntries();
  if (entries.length === 0) return null;

  let reportEntries;
  if (period === 'weekly') {
    reportEntries = entries.slice(-7);
  } else if (period === 'monthly') {
    reportEntries = entries.slice(-30);
  } else {
    reportEntries = [...entries];
  }

  if (reportEntries.length === 0) return null;

  // Calculate averages
  const count = reportEntries.length;
  const avgVal = (arr, key) => arr.reduce((sum, e) => sum + e[key], 0) / arr.length;

  const averages = {
    sleep: parseFloat(avgVal(reportEntries, 'sleep').toFixed(1)),
    stress: parseFloat(avgVal(reportEntries, 'stress').toFixed(1)),
    mood: parseFloat(avgVal(reportEntries, 'mood').toFixed(1)),
    screenTime: parseFloat(avgVal(reportEntries, 'screenTime').toFixed(1)),
    exercise: Math.round(avgVal(reportEntries, 'exercise'))
  };

  // Recovery scores for each entry
  const scores = reportEntries.map(e => calculateRecoveryScore(e));
  const avgScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);

  // Trend analysis — compare first half vs second half of period
  let trendDirection = 'stable';
  let trendDiff = 0;
  if (scores.length >= 2) {
    const mid = Math.floor(scores.length / 2);
    const firstAvg = scores.slice(0, mid).reduce((s, v) => s + v, 0) / mid;
    const secondAvg = scores.slice(mid).reduce((s, v) => s + v, 0) / (scores.length - mid);
    trendDiff = Math.round(secondAvg - firstAvg);
    if (trendDiff > 3) trendDirection = 'improving';
    else if (trendDiff < -3) trendDirection = 'declining';
  }

  // Risk distribution across the period
  let riskHigh = 0, riskMedium = 0, riskLow = 0;
  reportEntries.forEach(e => {
    const risk = getBurnoutRisk(e);
    if (risk.icon === 'alert-triangle') riskHigh++;
    else if (risk.icon === 'alert-circle') riskMedium++;
    else riskLow++;
  });

  // Generate human-readable behavioral insights
  const insights = generateReportInsights(reportEntries, averages, trendDirection, trendDiff, period);

  return {
    period,
    entryCount: count,
    averages,
    scores,
    avgScore,
    trend: { direction: trendDirection, diff: trendDiff },
    riskDistribution: { high: riskHigh, medium: riskMedium, low: riskLow },
    insights,
    entries: reportEntries
  };
}

/**
 * Generates human-readable behavioral insights for a report period.
 * Each insight has an icon, text, and emotional tone for UI rendering.
 */
function generateReportInsights(entries, averages, trendDirection, trendDiff, period) {
  const insights = [];
  const periodLabel = period === 'weekly' ? 'this week' : period === 'monthly' ? 'this month' : 'over the reporting period';

  // Sleep analysis
  if (averages.sleep >= 7) {
    insights.push({ icon: 'circle-check', text: `Your sleep consistency is strong ${periodLabel}, averaging ${averages.sleep} hours per night.`, tone: 'positive' });
  } else if (averages.sleep >= 5.5) {
    insights.push({ icon: 'alert-circle', text: `Sleep averaged ${averages.sleep} hours ${periodLabel}. Aim for 7+ hours to maximize recovery.`, tone: 'warning' });
  } else {
    insights.push({ icon: 'alert-triangle', text: `Significant sleep deficit detected ${periodLabel} (${averages.sleep} hrs avg). This is a primary recovery limiter.`, tone: 'critical' });
  }

  // Stress analysis
  if (averages.stress <= 4) {
    insights.push({ icon: 'circle-check', text: `Stress levels remained well-managed ${periodLabel}, averaging ${averages.stress}/10.`, tone: 'positive' });
  } else if (averages.stress <= 7) {
    insights.push({ icon: 'alert-circle', text: `Moderate stress levels detected (${averages.stress}/10 avg). Consider structured recovery periods.`, tone: 'warning' });
  } else {
    insights.push({ icon: 'alert-triangle', text: `Stress levels are your primary limiting factor ${periodLabel}, averaging ${averages.stress}/10.`, tone: 'critical' });
  }

  // Recovery trend
  if (trendDirection === 'improving') {
    insights.push({ icon: 'trending-up', text: `Overall recovery trend is improving by ${Math.abs(trendDiff)} points ${periodLabel}.`, tone: 'positive' });
  } else if (trendDirection === 'declining') {
    insights.push({ icon: 'trending-down', text: `Recovery metrics are declining by ${Math.abs(trendDiff)} points. Prioritize rest and stress reduction.`, tone: 'critical' });
  } else {
    insights.push({ icon: 'equal', text: `Recovery levels remain stable and consistent ${periodLabel}.`, tone: 'neutral' });
  }

  // Screen time analysis
  if (averages.screenTime > 6) {
    insights.push({ icon: 'smartphone', text: `High digital exposure detected (${averages.screenTime} hrs avg). This contributes to cognitive fatigue.`, tone: 'warning' });
  }

  // Exercise analysis
  if (averages.exercise >= 30) {
    insights.push({ icon: 'activity', text: `Physical activity is strong at ${averages.exercise} mins average, supporting recovery resilience.`, tone: 'positive' });
  } else if (averages.exercise < 15) {
    insights.push({ icon: 'activity', text: `Low physical activity detected (${averages.exercise} mins avg). Even brief movement improves recovery scores.`, tone: 'warning' });
  }

  // Mood analysis
  if (averages.mood <= 2) {
    insights.push({ icon: 'heart-pulse', text: `Persistently low mood indicators suggest emotional fatigue. Consider social recovery or professional support.`, tone: 'critical' });
  } else if (averages.mood >= 4) {
    insights.push({ icon: 'circle-check', text: `Mood levels are consistently positive ${periodLabel}, indicating strong emotional resilience.`, tone: 'positive' });
  }

  return insights;
}
