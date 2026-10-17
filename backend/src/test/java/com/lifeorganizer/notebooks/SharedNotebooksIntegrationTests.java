package com.lifeorganizer.notebooks;

import com.lifeorganizer.auth.*;
import com.lifeorganizer.watchlist.*;
import com.lifeorganizer.recipes.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:sharednotebooks;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "firebase.service-account-path=/nonexistent/test-firebase.json",
    "app.wishes.cleanup-cron=-", "app.memories.cleanup-cron=-", "app.memories.orphan-cron=-", "app.birthdays.cron=-"
})
@AutoConfigureMockMvc
class SharedNotebooksIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JwtService jwt;
    @Autowired WatchRepository watchItems;
    @Autowired WatchReviewRepository reviews;
    @Autowired WatchService watch;
    @Autowired RecipeRepository recipes;
    @Autowired RecipeService kitchen;
    @Autowired JdbcTemplate jdbc;
    User owner, recipient;
    static final String WATCH_BODY = """
        {"title":"  Notre prochain film  ","kind":"FILM","status":"TO_WATCH","notes":"  Pour dimanche  "}
        """;
    static final String RECIPE_BODY = """
        {"title":"  Nos pâtes au citron  ","status":"TO_TRY","servings":2,"minutes":25,
         "ingredients":[{"name":"  Pâtes  ","amount":"  200 g  "},{"name":"Citron","amount":"1"}],
         "steps":["  Faire cuire les pâtes.  ","Ajouter le citron."],"tips":"  Garder un peu d’eau de cuisson.  "}
        """;
    @BeforeEach void prepare() {
        reviews.deleteAllInBatch(); watchItems.deleteAllInBatch(); recipes.deleteAll();
        owner = users.findByRole(Role.OWNER).orElseThrow(); recipient = users.findByRole(Role.RECIPIENT).orElseThrow();
    }
    String auth(User user) { return "Bearer " + jwt.generateToken(user); }
    UUID film() { return watch.create(new WatchRequest("Notre film",WatchItem.Kind.FILM,WatchItem.Status.TO_WATCH,"Pour dimanche")).id(); }
    UUID recipe() { return kitchen.create(new RecipeRequest("Nos pâtes",Recipe.Status.TO_TRY,2,25,
            List.of(new RecipeRequest.Ingredient("Pâtes","200 g"),new RecipeRequest.Ingredient("Citron","1")),List.of("Cuire.","Mélanger."),"Du citron à la fin.")).id(); }

    @Test void everyNotebookEndpointRequiresAuthentication() throws Exception {
        UUID id = UUID.randomUUID();
        for (String path : List.of("/api/watchlist","/api/recipes")) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            mvc.perform(post(path).contentType("application/json").content("{}")).andExpect(status().isUnauthorized());
            mvc.perform(put(path+"/"+id).contentType("application/json").content("{}")).andExpect(status().isUnauthorized());
            mvc.perform(patch(path+"/"+id+"/status").contentType("application/json").content("{}")).andExpect(status().isUnauthorized());
            mvc.perform(delete(path+"/"+id)).andExpect(status().isUnauthorized());
        }
        mvc.perform(put("/api/watchlist/"+id+"/review").contentType("application/json").content("{}")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/watchlist/"+id+"/review")).andExpect(status().isUnauthorized());
    }
    @Test void bothAccountsCreateAndEditTheSharedWatchlist() throws Exception {
        for (User user : List.of(owner,recipient)) mvc.perform(post("/api/watchlist").header("Authorization",auth(user)).contentType("application/json").content(WATCH_BODY))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.title").value("Notre prochain film")).andExpect(jsonPath("$.notes").value("Pour dimanche"));
        UUID id = watchItems.findAll().getFirst().getId();
        mvc.perform(put("/api/watchlist/"+id).header("Authorization",auth(recipient)).contentType("application/json").content(WATCH_BODY.replace("FILM","SERIES").replace("TO_WATCH","IN_PROGRESS")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.kind").value("SERIES")).andExpect(jsonPath("$.status").value("IN_PROGRESS"));
        for (User user : List.of(owner,recipient)) mvc.perform(get("/api/watchlist").header("Authorization",auth(user))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
    }
    @Test void invalidTitlesFormatsStatusesAndOversizedNotesAreRejected() throws Exception {
        for (String body : List.of("{}",WATCH_BODY.replace("Notre prochain film"," "),WATCH_BODY.replace("Notre prochain film","x".repeat(151)),WATCH_BODY.replace("FILM","OTHER"),WATCH_BODY.replace("TO_WATCH","INVALID"),WATCH_BODY.replace("Pour dimanche","x".repeat(2001))))
            mvc.perform(post("/api/watchlist").header("Authorization",auth(owner)).contentType("application/json").content(body)).andExpect(status().isBadRequest());
        assertThat(watchItems.count()).isZero();
        UUID id = film();
        mvc.perform(patch("/api/watchlist/"+id+"/status").header("Authorization",auth(owner)).contentType("application/json").content("{}")).andExpect(status().isBadRequest());
        mvc.perform(patch("/api/watchlist/"+id+"/status").header("Authorization",auth(recipient)).contentType("application/json").content("{\"status\":\"IN_PROGRESS\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Notre film")).andExpect(jsonPath("$.notes").value("Pour dimanche"));
    }
    @Test void reviewsRequireWatchedStatusAndOneToFiveStars() throws Exception {
        UUID id = film();
        mvc.perform(put("/api/watchlist/"+id+"/review").header("Authorization",auth(owner)).contentType("application/json").content("{\"rating\":4}"))
            .andExpect(status().isConflict());
        watch.status(id,WatchItem.Status.WATCHED);
        for (String body : List.of("{}","{\"rating\":0}","{\"rating\":6}","{\"rating\":5,\"comment\":\""+"x".repeat(2001)+"\"}"))
            mvc.perform(put("/api/watchlist/"+id+"/review").header("Authorization",auth(owner)).contentType("application/json").content(body)).andExpect(status().isBadRequest());
        assertThat(reviews.count()).isZero();
    }
    @Test void eachAccountKeepsItsOwnReviewAndCanOnlyRemoveItsOwn() throws Exception {
        UUID id = film(); watch.status(id,WatchItem.Status.WATCHED);
        for (User user : List.of(owner,recipient)) mvc.perform(put("/api/watchlist/"+id+"/review").header("Authorization",auth(user)).contentType("application/json").content("{\"rating\":4,\"comment\":\"  À revoir  \"}"))
            .andExpect(status().isOk());
        mvc.perform(put("/api/watchlist/"+id+"/review").header("Authorization",auth(recipient)).contentType("application/json").content("{\"rating\":5,\"comment\":\"Mon préféré\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.reviews.length()").value(2));
        assertThat(reviews.findByItemIdAndUserId(id,owner.getId()).orElseThrow().getRating()).isEqualTo(4);
        assertThat(reviews.findByItemIdAndUserId(id,recipient.getId()).orElseThrow().getRating()).isEqualTo(5);
        mvc.perform(delete("/api/watchlist/"+id+"/review").header("Authorization",auth(recipient)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.reviews.length()").value(1)).andExpect(jsonPath("$.reviews[0].userId").value(owner.getId().toString()))
            .andExpect(jsonPath("$.reviews[0].comment").value("À revoir"));
        mvc.perform(delete("/api/watchlist/"+id+"/review").header("Authorization",auth(recipient))).andExpect(status().isOk()).andExpect(jsonPath("$.reviews.length()").value(1));
    }
    @Test void statusChangesPreserveReviewsAndDeletingATitleRemovesBothOpinions() throws Exception {
        UUID id = film(); watch.status(id,WatchItem.Status.WATCHED);
        watch.review(id,owner,new WatchRequest.ReviewRequest(4,"Bien")); watch.review(id,recipient,new WatchRequest.ReviewRequest(5,"Super"));
        watch.status(id,WatchItem.Status.IN_PROGRESS); assertThat(watch.list().getFirst().reviews()).hasSize(2);
        mvc.perform(delete("/api/watchlist/"+id).header("Authorization",auth(recipient))).andExpect(status().isNoContent());
        assertThat(watchItems.count()).isZero(); assertThat(reviews.count()).isZero();
        mvc.perform(delete("/api/watchlist/"+id).header("Authorization",auth(owner))).andExpect(status().isNotFound());
        mvc.perform(put("/api/watchlist/"+id+"/review").header("Authorization",auth(owner)).contentType("application/json").content("{\"rating\":4}")).andExpect(status().isNotFound());
    }
    @Test void overlappingReviewWritesKeepOneReviewPerAccount() throws Exception {
        UUID id = film(); watch.status(id,WatchItem.Status.WATCHED);
        try (var executor = Executors.newFixedThreadPool(3)) {
            var a = executor.submit(() -> watch.review(id,owner,new WatchRequest.ReviewRequest(3,"A")));
            var b = executor.submit(() -> watch.review(id,owner,new WatchRequest.ReviewRequest(4,"B")));
            var c = executor.submit(() -> watch.review(id,recipient,new WatchRequest.ReviewRequest(5,"C")));
            a.get(10,TimeUnit.SECONDS); b.get(10,TimeUnit.SECONDS); c.get(10,TimeUnit.SECONDS);
        }
        assertThat(reviews.count()).isEqualTo(2);
        assertThat(reviews.findByItemIdAndUserId(id,recipient.getId()).orElseThrow().getRating()).isEqualTo(5);
    }
    @Test void bothAccountsShareRecipesWithOrderedIngredientsStepsAndTips() throws Exception {
        mvc.perform(post("/api/recipes").header("Authorization",auth(owner)).contentType("application/json").content(RECIPE_BODY))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.title").value("Nos pâtes au citron"))
            .andExpect(jsonPath("$.ingredients[0].name").value("Pâtes")).andExpect(jsonPath("$.ingredients[0].amount").value("200 g"))
            .andExpect(jsonPath("$.steps[0]").value("Faire cuire les pâtes.")).andExpect(jsonPath("$.tips").value("Garder un peu d’eau de cuisson."));
        UUID id = recipes.findAll().getFirst().getId();
        mvc.perform(put("/api/recipes/"+id).header("Authorization",auth(recipient)).contentType("application/json").content(RECIPE_BODY.replace("TO_TRY","FAVORITE").replace("200 g","250 g")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.ingredients[0].amount").value("250 g"));
        for (User user : List.of(owner,recipient)) mvc.perform(get("/api/recipes").header("Authorization",auth(user)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].status").value("FAVORITE"))
            .andExpect(jsonPath("$[0].ingredients[1].name").value("Citron")).andExpect(jsonPath("$[0].steps[1]").value("Ajouter le citron."));
    }
    @Test void recipeValidationRejectsMissingEmptyAndOversizedNestedFields() throws Exception {
        for (String body : List.of("{}",RECIPE_BODY.replace("Nos pâtes au citron"," "),RECIPE_BODY.replace("TO_TRY","OTHER"),
                RECIPE_BODY.replace("\"servings\":2","\"servings\":0"),RECIPE_BODY.replace("\"servings\":2","\"servings\":51"),
                RECIPE_BODY.replace("\"minutes\":25","\"minutes\":0"),RECIPE_BODY.replace("\"minutes\":25","\"minutes\":1441"),
                RECIPE_BODY.replace("Pâtes"," "),RECIPE_BODY.replace("Pâtes","x".repeat(121)),RECIPE_BODY.replace("200 g","x".repeat(81)),
                RECIPE_BODY.replace("Faire cuire les pâtes."," "),RECIPE_BODY.replace("Faire cuire les pâtes.","x".repeat(2001))))
            mvc.perform(post("/api/recipes").header("Authorization",auth(recipient)).contentType("application/json").content(body)).andExpect(status().isBadRequest());
        String ingredientList = IntStream.range(0,101).mapToObj(i -> "{\"name\":\"Tomate\"}").collect(Collectors.joining(","));
        for (String invalid : List.of("{\"title\":\"Plat\",\"status\":\"TO_TRY\",\"servings\":2,\"ingredients\":[],\"steps\":[\"Cuire\"]}",
                "{\"title\":\"Plat\",\"status\":\"TO_TRY\",\"servings\":2,\"ingredients\":[null],\"steps\":[\"Cuire\"]}",
                "{\"title\":\"Plat\",\"status\":\"TO_TRY\",\"servings\":2,\"ingredients\":["+ingredientList+"],\"steps\":[\"Cuire\"]}"))
            mvc.perform(post("/api/recipes").header("Authorization",auth(owner)).contentType("application/json").content(invalid)).andExpect(status().isBadRequest());
        assertThat(recipes.count()).isZero();
    }
    @Test void quickFavoriteChangesDoNotOverwriteRecipeContent() throws Exception {
        UUID id = recipe();
        mvc.perform(patch("/api/recipes/"+id+"/status").header("Authorization",auth(recipient)).contentType("application/json").content("{\"status\":\"FAVORITE\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FAVORITE")).andExpect(jsonPath("$.ingredients.length()").value(2))
            .andExpect(jsonPath("$.steps.length()").value(2)).andExpect(jsonPath("$.tips").value("Du citron à la fin."));
        mvc.perform(patch("/api/recipes/"+id+"/status").header("Authorization",auth(owner)).contentType("application/json").content("{}")).andExpect(status().isBadRequest());
        mvc.perform(patch("/api/recipes/"+id+"/status").header("Authorization",auth(owner)).contentType("application/json").content("{\"status\":\"TO_TRY\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.servings").value(2));
    }
    @Test void replacingRecipeCollectionsRemovesOldRowsAndPreservesNewOrder() throws Exception {
        UUID id = recipe();
        mvc.perform(put("/api/recipes/"+id).header("Authorization",auth(owner)).contentType("application/json").content("""
            {"title":"Une recette simplifiée","status":"FAVORITE","servings":1,
             "ingredients":[{"name":"Citron"}],"steps":["Zester."],"tips":" "}
            """))
            .andExpect(status().isOk()).andExpect(jsonPath("$.ingredients.length()").value(1)).andExpect(jsonPath("$.ingredients[0].amount").isEmpty())
            .andExpect(jsonPath("$.steps[0]").value("Zester.")).andExpect(jsonPath("$.minutes").isEmpty()).andExpect(jsonPath("$.tips").isEmpty());
        assertThat(jdbc.queryForObject("select count(*) from recipe_ingredients",Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from recipe_steps",Integer.class)).isEqualTo(1);
    }
    @Test void deletingARecipeRemovesItsIngredientsAndStepsForBothAccounts() throws Exception {
        UUID id = recipe();
        mvc.perform(delete("/api/recipes/"+id).header("Authorization",auth(recipient))).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("select count(*) from recipe_ingredients",Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from recipe_steps",Integer.class)).isZero();
        for (User user : List.of(owner,recipient)) mvc.perform(get("/api/recipes").header("Authorization",auth(user))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(put("/api/recipes/"+id).header("Authorization",auth(owner)).contentType("application/json").content(RECIPE_BODY)).andExpect(status().isNotFound());
    }
}
