package com.example.authsession.controller;

import com.example.authsession.model.Ticket;
import com.example.authsession.service.TicketService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
@RequestMapping("/tickets")
public class TicketController {

    private final TicketService ticketService;

    public TicketController(TicketService ticketService) {
        this.ticketService = ticketService;
    }

    @GetMapping
    public String list(Model model) {
        model.addAttribute("tickets", ticketService.findAll());
        return "tickets";
    }

    @GetMapping("/new")
    public String createForm(Model model) {
        model.addAttribute("ticket", new Ticket(null, "", ""));
        model.addAttribute("isEdit", false);
        return "ticket-form";
    }

    @PostMapping
    public String create(
        @RequestParam String name,
        @RequestParam String description
    ) {
        ticketService.create(name, description);
        return "redirect:/tickets";
    }

    @GetMapping("/{id}/edit")
    public String editForm(@PathVariable Long id, Model model) {
        return ticketService.findById(id)
            .map(ticket -> {
                model.addAttribute("ticket", ticket);
                model.addAttribute("isEdit", true);
                return "ticket-form";
            })
            .orElse("redirect:/tickets");
    }

    @PostMapping("/{id}")
    public String update(
        @PathVariable Long id,
        @RequestParam String name,
        @RequestParam String description
    ) {
        ticketService.update(id, name, description);
        return "redirect:/tickets";
    }

    @PostMapping("/{id}/delete")
    public String delete(@PathVariable Long id) {
        ticketService.delete(id);
        return "redirect:/tickets";
    }
}
