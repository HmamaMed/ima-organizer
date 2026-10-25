package com.lifeorganizer.recipes;

import com.lifeorganizer.auth.User;
import com.lifeorganizer.couples.CoupleAccess;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@Profile("couples")
@Transactional(readOnly=true)
public class CoupleRecipeService {
    private final JdbcTemplate jdbc;private final CoupleAccess access;
    public CoupleRecipeService(JdbcTemplate jdbc,CoupleAccess access) { this.jdbc=jdbc;this.access=access; }
    private RowMapper<RecipeResponse> mapper(UUID scope) { return (r,n)->{
        UUID id=r.getObject("id",UUID.class);
        var ingredients=jdbc.query("select ingredient_name,amount from recipe_ingredients where recipe_id=? and couple_id=? order by ingredient_position",(x,i)->new RecipeRequest.Ingredient(x.getString(1),x.getString(2)),id,scope);
        var steps=jdbc.queryForList("select instruction from recipe_steps where recipe_id=? and couple_id=? order by step_position",String.class,id,scope);
        return new RecipeResponse(id,r.getString("title"),Recipe.Status.valueOf(r.getString("status")),r.getInt("servings"),r.getObject("minutes",Integer.class),ingredients,steps,r.getString("tips"),r.getTimestamp("created_at").toInstant());
    }; }
    public List<RecipeResponse> list(User user,int page,int size,String search) {
        UUID scope=access.requireScope(user);if(search.length()>100)throw new IllegalArgumentException("Search must be 100 characters or shorter");String term="%"+search.trim()+"%";
        return jdbc.query("select r.* from recipes r where r.couple_id=? and (r.title ilike ? or coalesce(r.tips,'') ilike ? or exists(select 1 from recipe_ingredients i where i.recipe_id=r.id and i.couple_id=r.couple_id and i.ingredient_name ilike ?)) order by r.created_at desc,r.id desc limit ? offset ?",mapper(scope),scope,term,term,term,Math.clamp(size,1,100),Math.max(0,page)*(long)Math.clamp(size,1,100));
    }
    public RecipeResponse get(User user,UUID id) { UUID scope=access.requireScope(user);return jdbc.query("select * from recipes where id=? and couple_id=?",mapper(scope),id,scope).stream().findFirst().orElseThrow(()->new NoSuchElementException("Recipe not found")); }
    private UUID lock(User user,UUID id) { UUID scope=access.requireScopeForWrite(user);if(jdbc.queryForList("select id from recipes where id=? and couple_id=? for update",UUID.class,id,scope).isEmpty())throw new NoSuchElementException("Recipe not found");return scope; }
    private void children(UUID id,UUID scope,RecipeRequest body) {
        jdbc.update("delete from recipe_ingredients where recipe_id=? and couple_id=?",id,scope);jdbc.update("delete from recipe_steps where recipe_id=? and couple_id=?",id,scope);
        for(int i=0;i<body.ingredients().size();i++){var ingredient=body.ingredients().get(i);jdbc.update("insert into recipe_ingredients(recipe_id,couple_id,ingredient_position,ingredient_name,amount) values (?,?,?,?,?)",id,scope,i,ingredient.name().trim(),ingredient.amount());}
        for(int i=0;i<body.steps().size();i++)jdbc.update("insert into recipe_steps(recipe_id,couple_id,step_position,instruction) values (?,?,?,?)",id,scope,i,body.steps().get(i).trim());
    }
    @Transactional public RecipeResponse create(User user,RecipeRequest body,UUID request) {
        UUID scope=access.requireScopeForWrite(user);
        var prior=jdbc.queryForList("select id from recipes where couple_id=? and creator_id=? and client_request_id=?",UUID.class,scope,user.getId(),request);if(!prior.isEmpty())return get(user,prior.getFirst());
        UUID id=UUID.randomUUID();jdbc.update("insert into recipes(id,couple_id,creator_id,client_request_id,title,status,servings,minutes,tips,created_at) values (?,?,?,?,?,?,?,?,?,current_timestamp)",id,scope,user.getId(),request,body.title().trim(),body.status().name(),body.servings(),body.minutes(),body.tips());children(id,scope,body);return get(user,id);
    }
    @Transactional public RecipeResponse update(User user,UUID id,RecipeRequest body) { UUID scope=lock(user,id);jdbc.update("update recipes set title=?,status=?,servings=?,minutes=?,tips=? where id=? and couple_id=?",body.title().trim(),body.status().name(),body.servings(),body.minutes(),body.tips(),id,scope);children(id,scope,body);return get(user,id); }
    @Transactional public RecipeResponse status(User user,UUID id,Recipe.Status status) { UUID scope=lock(user,id);jdbc.update("update recipes set status=? where id=? and couple_id=?",status.name(),id,scope);return get(user,id); }
    @Transactional public void delete(User user,UUID id) { UUID scope=lock(user,id);jdbc.update("delete from recipe_ingredients where recipe_id=? and couple_id=?",id,scope);jdbc.update("delete from recipe_steps where recipe_id=? and couple_id=?",id,scope);jdbc.update("delete from recipes where id=? and couple_id=?",id,scope); }
}
