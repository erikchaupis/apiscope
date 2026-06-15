package com.example.demo;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/users")
public class UserController {

  private final Map<Long, User> users = new ConcurrentHashMap<>();
  private final AtomicLong nextId = new AtomicLong(1);

  public UserController() {
    users.put(1L, new User(1L, "Ada", "Lovelace"));
    users.put(2L, new User(2L, "Jane", "Doe"));
    nextId.set(3);
  }

  @GetMapping
  public List<User> list() {
    return new ArrayList<>(users.values());
  }

  @GetMapping("/{id}")
  public User get(@PathVariable("id") Long id) {
    User user = users.get(id);
    if (user == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
    }
    return user;
  }

  @PostMapping
  public User create(@RequestBody User user) {
    long id = nextId.getAndIncrement();
    user.setId(id);
    users.put(id, user);
    return user;
  }

  @PutMapping("/{id}")
  public User update(@PathVariable("id") Long id, @RequestBody User user) {
    if (!users.containsKey(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
    }
    user.setId(id);
    users.put(id, user);
    return user;
  }

  @DeleteMapping("/{id}")
  public void delete(@PathVariable("id") Long id) {
    if (users.remove(id) == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
    }
  }

  @GetMapping("/search")
  public List<User> search(@RequestParam Optional<String> name) {
    if (name.isEmpty() || name.get().isBlank()) {
      return list();
    }
    String q = name.get().toLowerCase();
    return users.values().stream()
        .filter(u -> u.getName() != null && u.getName().toLowerCase().contains(q))
        .toList();
  }
}
