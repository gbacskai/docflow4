#!/bin/bash

# Headless User Type Test Runner
# This script installs dependencies and runs the headless test

echo "🚀 Starting Headless User Type Visibility Test"
echo "============================================="

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not found. Please install Node.js first."
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not found. Please install npm first."
    exit 1
fi

# Install Puppeteer if not already installed
echo "📦 Checking Puppeteer installation..."
if ! npm list puppeteer &> /dev/null; then
    echo "📥 Installing Puppeteer..."
    npm install puppeteer
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install Puppeteer"
        exit 1
    fi
    echo "✅ Puppeteer installed successfully"
else
    echo "✅ Puppeteer is already installed"
fi

# Check if Angular app is running
echo "🔍 Checking if Angular app is running on http://localhost:4200..."
if curl -s http://localhost:4200 > /dev/null; then
    echo "✅ Angular app is running"
else
    echo "❌ Angular app is not running on http://localhost:4200"
    echo "Please start your Angular app first:"
    echo "  npm start"
    echo "  or"
    echo "  ng serve"
    exit 1
fi

# Run the test
echo "🧪 Running headless test..."
node test-headless-user-type.js

# Capture exit code
exit_code=$?

echo ""
echo "============================================="
if [ $exit_code -eq 0 ]; then
    echo "🎉 Test completed successfully!"
else
    echo "⚠️  Test completed with failures!"
fi

exit $exit_code