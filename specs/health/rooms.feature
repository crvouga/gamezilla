@domain:health
Feature: Rooms
  Live rooms run in the room Worker's Durable Objects, and the API reaches
  them through a binding to that Worker.

  Scenario: The room Worker hosts the room namespace
    Then the room Worker hosts the room Durable Object namespace

  Scenario: The API reaches rooms through the room Worker
    Then the API Worker binds its rooms to the room Worker
