package com.lifeorganizer.privacy;

import com.lifeorganizer.auth.*;
import com.lifeorganizer.couples.*;
import com.lifeorganizer.identity.*;
import com.lifeorganizer.jobs.*;
import com.lifeorganizer.memories.*;
import com.lifeorganizer.notes.CoupleNoteService;
import jakarta.validation.constraints.*;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
@Profile("couples")
public class PrivacyService {
    private final UserRepository users;
    private final CoupleService couples;
    private final SessionStore sessions;
    private final JdbcTemplate jdbc;
    private final JobStore jobs;
    private final CoupleNoteService notes;
    private final CoupleMemoryService memories;
    private final com.lifeorganizer.recipes.CoupleRecipeService recipes;
    private final com.lifeorganizer.wishes.CoupleWishService wishes;
    public PrivacyService(UserRepository users,CoupleService couples,SessionStore sessions,JdbcTemplate jdbc,JobStore jobs,CoupleNoteService notes,CoupleMemoryService memories,com.lifeorganizer.recipes.CoupleRecipeService recipes,com.lifeorganizer.wishes.CoupleWishService wishes) { this.users=users;this.couples=couples;this.sessions=sessions;this.jdbc=jdbc;this.jobs=jobs;this.notes=notes;this.memories=memories;this.recipes=recipes;this.wishes=wishes; }
    @Transactional public UUID requestDeletion(User caller) {
        User user=users.lockById(caller.getId()).orElseThrow();
        var existing=jdbc.queryForList("select id from deletion_requests where user_id=?",UUID.class,user.getId());
        if (!existing.isEmpty()) return existing.getFirst();
        if (couples.current(user).coupleId()!=null) couples.disconnect(user);
        user.requestDeletion();sessions.revokeAll(user.getId());
        UUID id=UUID.randomUUID();
        jdbc.update("insert into deletion_requests(id,user_id) values (?,?)",id,user.getId());
        jdbc.update("insert into deletion_markers(user_id) values (?) on conflict(user_id) do nothing",user.getId());
        jobs.enqueue("ACCOUNT_DELETION",id,null,"account-deletion:"+id,Instant.now());
        return id;
    }
    @Transactional(readOnly=true) public Map<String,Object> export(User user) {
        Map<String,Object> data=new LinkedHashMap<>(); data.put("account",IdentityService.Account.from(user));data.put("exportedAt",Instant.now());data.put("personalBirthdays",jdbc.queryForList("select id,label,birthday_month,birthday_day,time_zone from birthday_reminders where user_id=?",user.getId()));
        var space=couples.current(user);
        if (space.coupleId()==null) return data;
        // Only the requester's own contributions; closed-space exports need a separately defined policy.
        data.put("sentNotes",allNotes(user,"sent"));data.put("privateNotes",allNotes(user,"drafts"));
        List<CoupleMemoryService.Moment> own=new ArrayList<>();
        for(int page=0;;page++) { var batch=memories.list(user,null,page,100);own.addAll(batch.stream().filter(m->m.creatorId().equals(user.getId())).toList());if(batch.size()<100)break; }
        data.put("moments",own);
        data.put("watchlistContributions",jdbc.queryForList("select id,title,kind,status,notes,created_at from watch_items where couple_id=? and created_by_id=?",space.coupleId(),user.getId()));
        data.put("wishes",jdbc.queryForList("select id from wishes where couple_id=? and owner_id=?",UUID.class,space.coupleId(),user.getId()).stream().map(id->wishes.get(user,id)).toList());
        data.put("recipeContributions",jdbc.queryForList("select id from recipes where couple_id=? and creator_id=?",UUID.class,space.coupleId(),user.getId()).stream().map(id->recipes.get(user,id)).toList());
        data.put("watchReviews",jdbc.queryForList("select item_id,rating,comment,updated_at from watch_reviews where couple_id=? and user_id=?",space.coupleId(),user.getId()));
        return data;
    }
    private List<CoupleNoteService.NoteView> allNotes(User user,String view) {
        List<CoupleNoteService.NoteView> all=new ArrayList<>();
        for(int page=0;;page++) { var batch=notes.list(user,view,page,100);all.addAll(batch);if(batch.size()<100)break; }
        return all;
    }
    public record Report(@NotNull Kind kind,@NotBlank @Size(max=2000) String message) { public enum Kind { PROBLEM, UNWANTED_PARTNER } }
    @Transactional public void report(User caller,Report report) {
        users.lockById(caller.getId()).orElseThrow();
        var space=couples.current(caller);
        jdbc.update("insert into support_reports(id,reporter_id,couple_id,kind,message) values (?,?,?,?,?)",UUID.randomUUID(),caller.getId(),space.coupleId(),report.kind().name(),report.message().trim());
        if(report.kind()==Report.Kind.UNWANTED_PARTNER && space.coupleId()!=null) couples.disconnect(caller);
    }
}
