#!/bin/bash

# Billing Service Build and Push Script
set -e

# Configuration
IMAGE_NAME="hcorptech/billing-service-elevate"
VERSION="0.0.5"
PLATFORM="linux/amd64"

echo "🚀 Building and pushing Docker image: ${IMAGE_NAME}:${VERSION}"
echo "📦 Platform: ${PLATFORM}"
echo ""

# Build the image
echo "🔨 Building Docker image..."
docker build --platform ${PLATFORM} -t ${IMAGE_NAME}:${VERSION} .

# Tag as latest
echo "🏷️  Tagging as latest..."
docker tag ${IMAGE_NAME}:${VERSION} ${IMAGE_NAME}:latest

# Push versioned image
echo "📤 Pushing versioned image..."
docker push ${IMAGE_NAME}:${VERSION}

# Push latest
echo "📤 Pushing latest image..."
docker push ${IMAGE_NAME}:latest

echo ""
echo "✅ Successfully built and pushed:"
echo "   - ${IMAGE_NAME}:${VERSION}"
echo "   - ${IMAGE_NAME}:latest"
echo ""
echo "🐳 To run the container:"
echo "   docker run -p 3002:3002 ${IMAGE_NAME}:${VERSION}"