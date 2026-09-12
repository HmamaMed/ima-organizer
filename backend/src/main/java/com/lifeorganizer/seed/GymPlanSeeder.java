package com.lifeorganizer.seed;

import com.lifeorganizer.gym.Exercise;
import com.lifeorganizer.gym.WorkoutDay;
import com.lifeorganizer.gym.WorkoutDayRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds a starter home-workout plan on first boot so the Gym Coach module
 * isn't an empty screen out of the box. Edit these days directly in the
 * database (or replace this class) to customize the real plan.
 */
@Component
@Order(1)
public class GymPlanSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(GymPlanSeeder.class);

    private final WorkoutDayRepository workoutDayRepository;

    public GymPlanSeeder(WorkoutDayRepository workoutDayRepository) {
        this.workoutDayRepository = workoutDayRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (workoutDayRepository.count() > 0) {
            return;
        }

        WorkoutDay legsCore = new WorkoutDay("Day 1 — Legs & Core", "Bodyweight only. Rest 45–60 sec between sets.", 0);
        legsCore.addExercise(new Exercise("Bodyweight squats", 3, "15", "Feet shoulder-width, chest up, sit back like you're reaching for a chair.", null));
        legsCore.addExercise(new Exercise("Glute bridges", 3, "15", "Squeeze at the top for a second before lowering.", null));
        legsCore.addExercise(new Exercise("Walking lunges", 3, "10 per leg", "Keep your front knee tracking over your ankle.", null));
        legsCore.addExercise(new Exercise("Plank hold", 3, "30 sec", "Keep hips level — squeeze the core, don't let them sag.", null));

        WorkoutDay upperBody = new WorkoutDay("Day 2 — Upper Body", "No equipment needed. Add a resistance band if you have one.", 1);
        upperBody.addExercise(new Exercise("Incline push-ups", 3, "12", "Hands on a couch or table edge, easier than a full push-up.", null));
        upperBody.addExercise(new Exercise("Resistance band rows", 3, "15", "Squeeze your shoulder blades together at the end of each pull.", null));
        upperBody.addExercise(new Exercise("Tricep dips", 3, "10", "Use a sturdy chair, keep elbows pointing back.", null));
        upperBody.addExercise(new Exercise("Superman holds", 3, "20 sec", "Lift arms and legs together, squeeze your lower back gently.", null));

        WorkoutDay fullBody = new WorkoutDay("Day 3 — Full Body & Cardio", "Keep moving between exercises with minimal rest.", 2);
        fullBody.addExercise(new Exercise("Jumping jacks", 3, "30 sec", "Steady pace — this is your warm-up and cardio in one.", null));
        fullBody.addExercise(new Exercise("Squat to press", 3, "12", "Bodyweight squat, then reach both arms overhead as you stand.", null));
        fullBody.addExercise(new Exercise("Mountain climbers", 3, "20 sec", "Keep your hips low and core tight, don't let your back arch.", null));
        fullBody.addExercise(new Exercise("Standing side bends", 3, "12 per side", "Slow and controlled — reach, don't twist.", null));

        workoutDayRepository.save(legsCore);
        workoutDayRepository.save(upperBody);
        workoutDayRepository.save(fullBody);

        log.info("Seeded starter 3-day workout plan");
    }
}
