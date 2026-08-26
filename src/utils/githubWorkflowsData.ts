export interface WorkflowFile {
  id: string;
  name: string;
  nameFa: string;
  filename: string;
  path: string;
  descriptionFa: string;
  category: 'ci' | 'docker' | 'release' | 'deploy';
  content: string;
}

export const GITHUB_WORKFLOWS: WorkflowFile[] = [
  {
    id: 'ci-build',
    name: 'CI & Build Pipeline',
    nameFa: 'تست، تایپ‌چک و بیلد خودکار (CI)',
    filename: 'ci-build.yml',
    path: '.github/workflows/ci-build.yml',
    descriptionFa: 'در هر کامیت (Push) یا پول‌ریکوئست به شاخه main/master، سورس‌کد پروژه را با Node.js بیلد کرده، خطاها را بررسی نموده و آرتیفکت نهایی dist را ذخیره می‌کند.',
    category: 'ci',
    content: `name: CI & Build

on:
  push:
    branches: [ "main", "master" ]
  pull_request:
    branches: [ "main", "master" ]
  workflow_dispatch:

jobs:
  build-and-test:
    name: Build & Validate
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci || npm install

      - name: Type check and lint
        run: npm run lint

      - name: Build fullstack app (Client + Server)
        run: npm run build

      - name: Upload production build artifact
        uses: actions/upload-artifact@v4
        with:
          name: movie-together-dist
          path: dist/
          retention-days: 14`
  },
  {
    id: 'docker-publish',
    name: 'Docker Container Build & Publish',
    nameFa: 'ساخت و انتشار ایمیج داکر (GHCR / Docker Hub)',
    filename: 'docker-publish.yml',
    path: '.github/workflows/docker-publish.yml',
    descriptionFa: 'با هر آپدیت، یک ایمیج کانتینری بهینه داکر از Movie Together می‌سازد و به طور خودکار در مخزن کانتینر گیت‌هاب (GitHub Container Registry) یا Docker Hub منتشر می‌کند.',
    category: 'docker',
    content: `name: Docker Build & Publish

on:
  push:
    branches: [ "main", "master" ]
    tags: [ 'v*.*.*' ]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  docker-build:
    name: Build & Push Container Image
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to the Container registry
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata (tags, labels) for Docker
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest,enable=\${{ github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master' }}
            type=semver,pattern={{version}}
            type=sha

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max`
  },
  {
    id: 'deploy-release',
    name: 'Automated GitHub Release',
    nameFa: 'انتشار خودکار نسخه و بسته Release',
    filename: 'deploy-release.yml',
    path: '.github/workflows/deploy-release.yml',
    descriptionFa: 'با ارسال هر Tag نسخه مانند v1.0.0، سورس پروداکشن آماده شده را بسته‌بندی کرده و همراه با توضیحات تغییرات در قسمت Releases مخزن گیت‌هاب قرار می‌دهد.',
    category: 'release',
    content: `name: Release & Deploy

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  release:
    name: Create GitHub Release
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install & Build
        run: |
          npm ci || npm install
          npm run build

      - name: Package Release ZIP
        run: |
          zip -r movie-together-release.zip dist/ package.json package-lock.json

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: movie-together-release.zip
          generate_release_notes: true`
  }
];
