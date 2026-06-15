package com.example.demo;

public class User {
  private Long id;
  private String name;
  private String lastname;

  public User() {}

  public User(Long id, String name, String lastname) {
    this.id = id;
    this.name = name;
    this.lastname = lastname;
  }

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getLastname() {
    return lastname;
  }

  public void setLastname(String lastname) {
    this.lastname = lastname;
  }
}
