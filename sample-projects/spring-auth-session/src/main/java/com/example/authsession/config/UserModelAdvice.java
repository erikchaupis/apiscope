package com.example.authsession.config;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

@ControllerAdvice
public class UserModelAdvice {

    @ModelAttribute("username")
    public String username(Authentication authentication) {
        return authentication != null ? authentication.getName() : "";
    }
}
