package com.lifeorganizer.wishes;

import com.lifeorganizer.auth.User;
import com.lifeorganizer.jobs.*;
import jakarta.validation.Valid;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;

@RestController @Profile("couples") @RequestMapping("/api/wishes")
public class CoupleWishController {
    private final CoupleWishService wishes;public CoupleWishController(CoupleWishService wishes){this.wishes=wishes;}
    @GetMapping public List<CoupleWishService.Wish> list(@AuthenticationPrincipal User user,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="50")int size){return wishes.list(user,page,size);}
    @GetMapping("/{id}") public CoupleWishService.Wish get(@AuthenticationPrincipal User user,@PathVariable UUID id){return wishes.get(user,id);}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public CoupleWishService.Wish create(@AuthenticationPrincipal User user,@Valid @RequestBody WishRequest body,@RequestHeader(value="Idempotency-Key",required=false)UUID key){return wishes.create(user,body,key==null?UUID.randomUUID():key);}
    @PutMapping("/{id}") public CoupleWishService.Wish update(@AuthenticationPrincipal User user,@PathVariable UUID id,@Valid @RequestBody WishRequest body){return wishes.update(user,id,body);}
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@AuthenticationPrincipal User user,@PathVariable UUID id){wishes.delete(user,id);}
    @PostMapping(value="/photos",consumes="multipart/form-data") @ResponseStatus(HttpStatus.CREATED) public CoupleWishService.Upload upload(@AuthenticationPrincipal User user,@RequestPart MultipartFile file){return wishes.upload(user,file);}
    @Component @Profile("couples") public static class Cleanup implements DurableJobHandler {
        private final CoupleWishService wishes;public Cleanup(CoupleWishService wishes){this.wishes=wishes;}public String kind(){return "WISH_PHOTO_CLEANUP";}public void process(JobStore.Job job){wishes.cleanup(job.resourceId(),job.coupleId());}
    }
}
