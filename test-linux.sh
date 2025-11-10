#!/bin/bash

# Build and test script for Linux container

echo "🐧 Building Linux Docker image..."
docker build -f Dockerfile.linux -t npm-practice-linux .

echo ""
echo "✅ Linux image built successfully!"
echo ""
echo "📝 To test the app in Linux container:"
echo "   docker run -it --rm npm-practice-linux"
echo ""
echo "Once inside the container, run:"
echo "   cd /home/tester/npm-practice-source"
echo "   npm link"
echo "   cd /home/tester/test-workspace"
echo "   npm-practice"
echo ""
echo "To run automated tests:"
echo "   docker run -it --rm npm-practice-linux bash -c 'cd /home/tester/npm-practice-source && npm test'"
