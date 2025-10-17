#!/bin/bash
echo "🔧 Firebase CORS Setup Script"
echo ""
echo "Setting CORS for: outfit-generator-sal.firebasestorage.app"
echo ""

# Check if gsutil is installed
if ! command -v gsutil &> /dev/null; then
    echo "❌ gsutil not found!"
    echo ""
    echo "Install Google Cloud SDK:"
    echo "  Mac: brew install google-cloud-sdk"
    echo "  Or: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if firebase-cors.json exists
if [ ! -f "firebase-cors.json" ]; then
    echo "❌ firebase-cors.json not found!"
    echo "Run this script from the project root directory."
    exit 1
fi

echo "✅ gsutil found"
echo "✅ firebase-cors.json found"
echo ""
echo "Applying CORS configuration..."
echo ""

gsutil cors set firebase-cors.json gs://outfit-generator-sal.firebasestorage.app

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ CORS configured successfully!"
    echo ""
    echo "Verifying..."
    gsutil cors get gs://outfit-generator-sal.firebasestorage.app
    echo ""
    echo "🎉 All done! Now refresh your site with Cmd+Shift+R"
else
    echo ""
    echo "❌ Failed to set CORS"
    echo ""
    echo "Try running manually:"
    echo "  gsutil cors set firebase-cors.json gs://outfit-generator-sal.firebasestorage.app"
fi
