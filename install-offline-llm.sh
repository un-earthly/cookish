#!/bin/bash

# Offline LLM Dependencies Installation Script
# Run this script to install required packages for offline AI capabilities

echo "🤖 Installing Offline LLM Dependencies..."
echo ""

# Install npm packages
echo "📦 Installing npm package..."
npm install llama.rn

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "📱 Platform-specific setup:"
echo ""
echo "For iOS:"
echo "  cd ios && pod install && cd .."
echo ""
echo "For Android:"
echo "  No additional steps required"
echo ""
echo "📚 Read OFFLINE_LLM_SETUP.md for complete setup instructions"
echo ""
echo "🎉 Ready to use offline AI!"
