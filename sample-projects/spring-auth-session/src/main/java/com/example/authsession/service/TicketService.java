package com.example.authsession.service;

import com.example.authsession.model.Ticket;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Service;

@Service
public class TicketService {

    private final Map<Long, Ticket> tickets = new ConcurrentHashMap<>();
    private final AtomicLong nextId = new AtomicLong(4);

    public TicketService() {
        tickets.put(1L, new Ticket(1L, "Login page blank", "Login form does not render on mobile Safari"));
        tickets.put(2L, new Ticket(2L, "Session timeout", "Users are logged out after 5 minutes of inactivity"));
        tickets.put(3L, new Ticket(3L, "Export tickets", "Add CSV export for the ticket table"));
    }

    public List<Ticket> findAll() {
        List<Ticket> all = new ArrayList<>(tickets.values());
        all.sort(Comparator.comparing(Ticket::id));
        return all;
    }

    public Optional<Ticket> findById(Long id) {
        return Optional.ofNullable(tickets.get(id));
    }

    public Ticket create(String name, String description) {
        long id = nextId.getAndIncrement();
        Ticket ticket = new Ticket(id, name, description);
        tickets.put(id, ticket);
        return ticket;
    }

    public Optional<Ticket> update(Long id, String name, String description) {
        if (!tickets.containsKey(id)) {
            return Optional.empty();
        }
        Ticket ticket = new Ticket(id, name, description);
        tickets.put(id, ticket);
        return Optional.of(ticket);
    }

    public boolean delete(Long id) {
        return tickets.remove(id) != null;
    }
}
