#!/bin/bash

# Automated test runner for Linux container

echo "🧪 Running automated tests in Linux container..."
echo ""

docker run --rm npm-practice-linux bash -c '
    set -e
    echo "📦 Setting up npm-practice..."
    cd /home/tester/npm-practice-source
    
    echo "🔗 Linking npm-practice globally..."
    sudo npm link
    
    echo "🚀 Running test suite..."
    cd /home/tester/npm-practice-source
    npm test
    
    echo ""
    echo "✅ All tests completed!"
'

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo ""
    echo "✅ Linux tests PASSED"
else
    echo ""
    echo "❌ Linux tests FAILED with exit code $exit_code"
fi

exit $exit_code
