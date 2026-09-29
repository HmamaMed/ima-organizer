package com.lifeorganizer.seed;

import com.lifeorganizer.gym.DayExercise;
import com.lifeorganizer.gym.LibraryExercise;
import com.lifeorganizer.gym.LibraryExerciseRepository;
import com.lifeorganizer.gym.MuscleGroup;
import com.lifeorganizer.gym.Programme;
import com.lifeorganizer.gym.ProgrammeDay;
import com.lifeorganizer.gym.ProgrammeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Seeds a starter exercise library and a 3-day programme built from it, so the
 * owner opens the builder with something to remix rather than a blank screen.
 *
 * Guarded on the library being empty: once there's anything in there, this
 * never touches the data again.
 */
@Component
@Order(1)
public class GymPlanSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(GymPlanSeeder.class);

    private final LibraryExerciseRepository exerciseRepository;
    private final ProgrammeRepository programmeRepository;

    public GymPlanSeeder(LibraryExerciseRepository exerciseRepository,
                         ProgrammeRepository programmeRepository) {
        this.exerciseRepository = exerciseRepository;
        this.programmeRepository = programmeRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (exerciseRepository.count() > 0) {
            return;
        }

        Map<String, LibraryExercise> library = seedLibrary();

        Programme programme = new Programme(
                "Starter plan",
                "Three easy home sessions — no equipment needed. Swap anything you like.",
                true);

        ProgrammeDay legsCore = new ProgrammeDay("Day 1 — Legs & Core", "Start here. Rest 45–60 sec between sets ♥");
        legsCore.addExercise(new DayExercise(library.get("Bodyweight squats"), 3, "15", 60, null));
        legsCore.addExercise(new DayExercise(library.get("Glute bridges"), 3, "15", 45, null));
        legsCore.addExercise(new DayExercise(library.get("Walking lunges"), 3, "10 per leg", 60, null));
        legsCore.addExercise(new DayExercise(library.get("Plank hold"), 3, "30 sec", 45, null));

        ProgrammeDay upperBody = new ProgrammeDay("Day 2 — Upper Body", "Add a resistance band if you have one.");
        upperBody.addExercise(new DayExercise(library.get("Incline push-ups"), 3, "12", 60, null));
        upperBody.addExercise(new DayExercise(library.get("Resistance band rows"), 3, "15", 45, null));
        upperBody.addExercise(new DayExercise(library.get("Tricep dips"), 3, "10", 60, null));
        upperBody.addExercise(new DayExercise(library.get("Superman holds"), 3, "20 sec", 45, null));

        ProgrammeDay fullBody = new ProgrammeDay("Day 3 — Full Body & Cardio", "Keep moving — minimal rest between these.");
        fullBody.addExercise(new DayExercise(library.get("Jumping jacks"), 3, "30 sec", 30, null));
        fullBody.addExercise(new DayExercise(library.get("Squat to press"), 3, "12", 45, null));
        fullBody.addExercise(new DayExercise(library.get("Mountain climbers"), 3, "20 sec", 30, null));
        fullBody.addExercise(new DayExercise(library.get("Standing side bends"), 3, "12 per side", 30, null));

        programme.addDay(legsCore);
        programme.addDay(upperBody);
        programme.addDay(fullBody);
        programmeRepository.save(programme);

        log.info("Seeded {} library exercises and the starter 3-day programme", library.size());
    }

    private Map<String, LibraryExercise> seedLibrary() {
        Map<String, LibraryExercise> library = new LinkedHashMap<>();

        add(library, "Bodyweight squats", MuscleGroup.LEGS,
                "Feet shoulder-width, chest up, sit back like you're reaching for a chair.");
        add(library, "Glute bridges", MuscleGroup.GLUTES,
                "Squeeze at the top for a second before lowering.");
        add(library, "Walking lunges", MuscleGroup.LEGS,
                "Keep your front knee tracking over your ankle.");
        add(library, "Plank hold", MuscleGroup.CORE,
                "Keep hips level — squeeze the core, don't let them sag.");
        add(library, "Incline push-ups", MuscleGroup.UPPER_BODY,
                "Hands on a couch or table edge, easier than a full push-up.");
        add(library, "Resistance band rows", MuscleGroup.UPPER_BODY,
                "Squeeze your shoulder blades together at the end of each pull.");
        add(library, "Tricep dips", MuscleGroup.UPPER_BODY,
                "Use a sturdy chair, keep elbows pointing back.");
        add(library, "Superman holds", MuscleGroup.CORE,
                "Lift arms and legs together, squeeze your lower back gently.");
        add(library, "Jumping jacks", MuscleGroup.CARDIO,
                "Steady pace — this is your warm-up and cardio in one.");
        add(library, "Squat to press", MuscleGroup.FULL_BODY,
                "Bodyweight squat, then reach both arms overhead as you stand.");
        add(library, "Mountain climbers", MuscleGroup.CARDIO,
                "Keep your hips low and core tight, don't let your back arch.");
        add(library, "Standing side bends", MuscleGroup.MOBILITY,
                "Slow and controlled — reach, don't twist.");

        exerciseRepository.saveAll(library.values());
        return library;
    }

    /** Images are left null on purpose — the owner pastes real ones from the web. */
    private void add(Map<String, LibraryExercise> library, String name, MuscleGroup group, String instructions) {
        library.put(name, new LibraryExercise(name, null, null, instructions, group));
    }
}
