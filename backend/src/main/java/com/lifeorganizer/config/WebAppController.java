package com.lifeorganizer.config;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** Serve the built React app for links opened from account emails and app navigation. */
@Controller
@Profile("couples")
public class WebAppController {
    @GetMapping({"/", "/home", "/join", "/verify", "/reset", "/delete-account", "/privacy",
        "/profile", "/notes", "/memories", "/watchlist", "/recipes", "/wishes", "/inbox", "/birthdays", "/notifications"})
    public String app() { return "forward:/index.html"; }
}
