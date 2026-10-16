package br.dev.noiteboa.goal.dto;

import java.time.LocalTime;

public class GoalResponse {
    private final int targetMinutes;
    private final LocalTime bedtime;
    private final LocalTime wakeTime;
    private final boolean hasGoal;

    public GoalResponse(int targetMinutes, LocalTime bedtime, LocalTime wakeTime, boolean hasGoal) {
        this.targetMinutes = targetMinutes;
        this.bedtime = bedtime;
        this.wakeTime = wakeTime;
        this.hasGoal = hasGoal;
    }

    public int getTargetMinutes() { return targetMinutes; }
    public LocalTime getBedtime() { return bedtime; }
    public LocalTime getWakeTime() { return wakeTime; }

    /** true quando o usuário já salvou uma meta; false quando estes valores são o default de 8h. */
    public boolean isHasGoal() { return hasGoal; }
}
