# Test Scraper UGC - Documentation

## Description

Le script `test_scraper.py` permet de tester le scraper UGC et de générer des fichiers de visualisation des données scrapées.

**Ce qu'il génère :**
- Un fichier **JSON** contenant toutes les données brutes (structure complète)
- Un fichier **Markdown** contenant EXACTEMENT le `scrapedContent` que reçoit `llmService` dans le backend

## Utilisation

### Mode CLI (recommandé)

```bash
# Tester un seul cinéma
python3 test_scraper.py 57

# Tester plusieurs cinémas
python3 test_scraper.py 57 42 8
```

### Mode interactif

```bash
python3 test_scraper.py
```

Puis suivez les instructions à l'écran.

## Exemples de cinémas UGC

| ID | Nom du cinéma |
|----|---------------|
| 57 | UGC Ciné Cité Paris 19 |
| 42 | UGC Montparnasse |
| 8  | UGC Les Halles |
| 19 | UGC George V |

## Fichiers générés

### 1. Fichier JSON (`scraped_data_<id>_<timestamp>.json`)

Contient la structure complète des données :

```json
{
  "success": true,
  "cinema": {
    "id": 57,
    "name": "UGC Cinéma 57"
  },
  "available_dates": ["2026-01-13", "2026-01-14", ...],
  "films": [
    {
      "film_id": "17892",
      "title": "PARASAKTHI (TAMOUL)",
      "genre": "Action, Drame",
      "duration": "2h43",
      "director": "Sudha Kongara",
      "actors": "Sivakarthikeyan, Sree Leela, Ravi Mohan",
      "rating": 3.8,
      "release_date": "10 janvier 2026",
      "showings": {
        "2026-01-13": [
          {
            "start": "17:10",
            "end": "20:05",
            "version": "VOSTF"
          }
        ]
      }
    }
  ],
  "film_count": 36,
  "total_films_scraped": 54,
  "films_filtered": 18
}
```

**Utilité :** Analyse complète des données, debugging, statistiques

### 2. Fichier Markdown (`scraped_content_<id>_<timestamp>.md`)

Contient EXACTEMENT le texte formaté envoyé au LLM dans `llmService.js:179`.

```markdown
# UGC Cinéma 57

**Films a l'affiche** (36 films):

## 1. PARASAKTHI (TAMOUL)
- **Genre**: Action, Drame
- **Duree**: 2h43
- **Realisateur**: Sudha Kongara
- **Acteurs**: Sivakarthikeyan, Sree Leela, Ravi Mohan
- **Note**: 3.8/5
- **2026-01-13**: 17:10, 20:45

## 2. CHASSE GARDEE 2
...
```

**Utilité :**
- Visualiser exactement ce que le LLM reçoit pour générer ses recommandations
- Tester/améliorer les prompts du LLM
- Vérifier le formatage des données

## Correspondance avec le backend

### Flux de données :

1. **Backend** (`llmService.js:154-174`) → appelle MCP via `mcpClient`
2. **MCP Client** (`mcpClient.js:129-146`) → lance le serveur Python
3. **MCP Server** (`server.py:85-112`) → appelle `scraper_ugc.py`
4. **Scraper** (`scraper_ugc.py:21-86`) → récupère les données UGC
5. **Formatage** (`server.py:129-168`) → fonction `format_for_llm()`
6. **Retour au Backend** → `scrapedContent` utilisé dans le prompt (ligne 179-210)

### Fonction de formatage identique

La fonction `format_for_llm()` dans `test_scraper.py` est **identique** à celle dans `server.py:129-168`.

Cela garantit que le fichier Markdown généré contient EXACTEMENT le même contenu que celui reçu par le LLM.

## Informations techniques

### Statistiques affichées

Lors de l'exécution, le script affiche :
- Nombre de films avec séances programmées
- Nombre de films filtrés (sans séances)
- Nombre de dates disponibles
- Taille du contenu généré (en caractères)
- Aperçu des 800 premiers caractères

### Notes importantes

1. **Films filtrés** : Le scraper filtre automatiquement les films sans séances programmées (voir `scraper_ugc.py:62-66`)

2. **Limite de dates** : Seules les 7 prochaines dates sont scrapées (voir `scraper_ugc.py:48`)

3. **Limite d'horaires** : Maximum 5 horaires par date dans le Markdown (voir `server.py:162`)

4. **Polite scraping** : Délai de 0.3s entre chaque requête (voir `scraper_ugc.py:60`)

## Exemple de sortie

```
============================================================
[TEST SCRAPING] - Cinema ID: 57
============================================================

[INFO] Scraping en cours...
[OK] Scraping reussi!
   - Cinema: UGC Cinéma 57
   - Films avec seances: 36
   - Films filtres (sans seances): 18
   - Dates disponibles: 7

[FILE] JSON brut sauvegarde: scraped_data_57_20260113_142851.json
[FILE] Markdown (scrapedContent) sauvegarde: scraped_content_57_20260113_142851.md
   - Taille: 8783 caracteres

[PREVIEW] APERCU DU CONTENU (premiers 800 caracteres):
------------------------------------------------------------
# UGC Cinéma 57

**Films a l'affiche** (36 films):
...
```

## Troubleshooting

### Erreur "Aucune date disponible trouvée"
- Le cinéma ID n'existe pas ou n'a pas de programmation
- Vérifier sur https://www.ugc.fr/cinema.html?id=XX

### Erreur de connexion
- Vérifier la connexion Internet
- Le site UGC peut être temporairement indisponible

### Films filtrés (0 film avec séances)
- Tous les films scrapés n'ont pas de séances programmées
- Normal pour certains petits cinémas ou en dehors des heures de programmation
