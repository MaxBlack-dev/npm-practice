#!/bin/bash

# Interactive test runner for Linux container

echo "🐧 Starting interactive Linux container..."
echo ""
echo "Inside the container, run these commands:"
echo ""
echo "  cd /home/tester/npm-practice-source"
echo "  sudo npm link"
echo "  cd /home/tester/test-workspace"
echo "  npm-practice"
echo ""
echo "Or to run tests:"
echo "  cd /home/tester/npm-practice-source"
echo "  npm test"
echo ""
echo "Press Ctrl+D or type 'exit' to leave the container"
echo ""

docker run -it --rm npm-practice-linux
