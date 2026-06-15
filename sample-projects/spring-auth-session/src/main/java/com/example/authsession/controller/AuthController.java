package com.example.authsession.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller
public class AuthController {

    @GetMapping("/health")
    @ResponseBody
    public String health() {
        return "OK";
    }

    @GetMapping("/login")
    public String login() {
        return "login";
    }
}
