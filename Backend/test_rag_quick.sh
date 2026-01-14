#!/bin/bash

echo "=========================================="
echo "🧪 TEST RAPIDE RAG - 1 CINÉMA"
echo "=========================================="
echo ""

# Vérifier qu'Ollama tourne
echo "1️⃣  Vérification Ollama..."
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo "❌ Ollama n'est pas lancé"
  echo "   Lancez-le avec: ollama serve"
  exit 1
fi
echo "✅ Ollama OK"

# Vérifier le modèle d'embedding
echo ""
echo "2️⃣  Vérification modèle d'embedding..."
if ! curl -s http://localhost:11434/api/tags | grep -q "mxbai-embed-large"; then
  echo "❌ Modèle mxbai-embed-large non trouvé"
  echo "   Installez-le avec: ollama pull mxbai-embed-large"
  exit 1
fi
echo "✅ Modèle mxbai-embed-large OK"

# Vérifier que le backend tourne
echo ""
echo "3️⃣  Vérification backend..."
if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
  echo "❌ Backend non accessible sur http://localhost:3001"
  echo "   Lancez-le avec: npm start"
  exit 1
fi
echo "✅ Backend OK"

# Lancer le test rapide
echo ""
echo "4️⃣  Lancement scraping test (cinéma 57)..."
echo "   Cela peut prendre 2-3 minutes..."
echo ""

curl -X POST http://localhost:3001/api/admin/quick-update \
  -H "Content-Type: application/json" \
  -d '{"cinema_ids": ["57"]}' \
  2>/dev/null | jq '.'

# Vérifier les stats
echo ""
echo "5️⃣  Statistiques de la base..."
curl -s http://localhost:3001/api/admin/stats | jq '.statistics | {total_films, total_cinemas}'

echo ""
echo "=========================================="
echo "✅ Test terminé !"
echo "=========================================="
