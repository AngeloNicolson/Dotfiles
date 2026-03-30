#!/bin/bash

awww query
if [ $? -eq 1 ]; then
  awww-daemon --format xrgb &
  sleep 0.5
  awww restore
fi
