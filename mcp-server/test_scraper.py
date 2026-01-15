#!/usr/bin/env python3
"""
Script de test pour le scraper UGC
Genere les fichiers JSON et Markdown exactement comme recus par llmService
"""
import json
from datetime import datetime
from scraper_ugc import scraper

def format_for_llm(result: dict) -> str:
    """
    Formate les donnees scrapees en JSON structure optimise pour le LLM
    (IDENTIQUE a la fonction dans server.py)

    Retourne un JSON compact avec:
    - Infos cinema
    - Liste des films avec metadonnees
    - Seances groupees par date (limite a 3 prochaines dates)
    """
    import re

    cinema = result["cinema"]
    films = result["films"]

    # Conversion de la duree en minutes (ex: "2h43" -> 163)
    def parse_duration(duration_str):
        if not duration_str:
            return None
        # Format: "2h43" ou "1h30"
        match = re.match(r"(\d+)h(\d+)?", duration_str)
        if match:
            hours = int(match.group(1))
            minutes = int(match.group(2)) if match.group(2) else 0
            return hours * 60 + minutes
        return None

    # Separation des acteurs en liste
    def parse_actors(actors_str):
        if not actors_str:
            return []
        return [a.strip() for a in actors_str.split(',')]

    # Construction du JSON structure
    formatted_films = []

    for film in films:
        film_data = {
            "film_id": film.get("film_id"),
            "title": film.get("title"),
            "genre": film.get("genre"),
            "duration_minutes": parse_duration(film.get("duration")),
            "duration_display": film.get("duration"),
            "director": film.get("director"),
            "actors": parse_actors(film.get("actors")),
            "rating": film.get("rating"),
            "release_date": film.get("release_date"),
            "seances": []
        }

        # Horaires (limite aux 3 prochaines dates)
        if film.get("showings"):
            dates = sorted(film["showings"].keys())[:3]
            for date in dates:
                seances_list = film["showings"][date][:5]  # Max 5 horaires par date
                if seances_list:
                    film_data["seances"].append({
                        "date": date,
                        "horaires": seances_list
                    })

        formatted_films.append(film_data)

    # Structure finale
    cinema_data = {
        "cinema_id": cinema.get("id"),
        "cinema_name": cinema.get("name"),
        "films": formatted_films
    }

    # Retourne le JSON en string compact
    return json.dumps(cinema_data, ensure_ascii=False, separators=(',', ':'))


def test_single_cinema(cinema_id: int, cinema_name: str = ""):
    """
    Test le scraping d'un seul cinema et genere les fichiers de sortie
    """
    print(f"\n{'='*60}")
    print(f"[TEST SCRAPING] - Cinema ID: {cinema_id}")
    print(f"{'='*60}\n")

    # Scraping
    print(f"[INFO] Scraping en cours...")
    result = scraper.scrape_cinema(cinema_id, cinema_name)

    if not result["success"]:
        print(f"[ERREUR] {result.get('error')}")
        return None

    # Affichage resume
    print(f"[OK] Scraping reussi!")
    print(f"   - Cinema: {result['cinema']['name']}")
    print(f"   - Films avec seances: {result['film_count']}")
    print(f"   - Films filtres (sans seances): {result['films_filtered']}")
    print(f"   - Dates disponibles: {len(result['available_dates'])}")

    # Generation timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # 1. Sauvegarde JSON brut (donnees completes)
    json_filename = f"scraped_data_{cinema_id}_{timestamp}.json"
    with open(json_filename, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\n[FILE] JSON brut sauvegarde: {json_filename}")

    # 2. Generation du contenu formate pour le LLM (scrapedContent)
    scraped_content = format_for_llm(result)

    # 3. Sauvegarde JSON formate (exactement ce que recoit llmService)
    json_llm_filename = f"scraped_content_llm_{cinema_id}_{timestamp}.json"
    with open(json_llm_filename, 'w', encoding='utf-8') as f:
        # Parse puis re-formatte pour lisibilite
        parsed = json.loads(scraped_content)
        json.dump(parsed, f, indent=2, ensure_ascii=False)

    print(f"[FILE] JSON LLM (scrapedContent) sauvegarde: {json_llm_filename}")
    print(f"   - Taille: {len(scraped_content)} caracteres")
    print(f"   - Nombre de films: {len(parsed['films'])}")

    # 4. Affichage apercu
    print(f"\n{'-'*60}")
    print("[PREVIEW] APERCU DU JSON LLM (premiers 2 films):")
    print(f"{'-'*60}")
    preview_data = {
        "cinema_id": parsed["cinema_id"],
        "cinema_name": parsed["cinema_name"],
        "films": parsed["films"][:2]  # Seulement les 2 premiers films
    }
    print(json.dumps(preview_data, indent=2, ensure_ascii=False))
    if len(parsed['films']) > 2:
        print(f"\n... (+ {len(parsed['films']) - 2} films)")
    print(f"{'-'*60}\n")

    return result


def test_multiple_cinemas(cinema_ids: list):
    """
    Test le scraping de plusieurs cinemas (comme scrape_multiple_ugc_cinemas)
    """
    print(f"\n{'='*60}")
    print(f"[TEST SCRAPING MULTIPLE] - {len(cinema_ids)} cinemas")
    print(f"{'='*60}\n")

    all_cinemas = []
    total_films = 0
    total_filtered = 0

    for cinema_id in cinema_ids:
        print(f"\n[INFO] Scraping cinema {cinema_id}...")
        result = scraper.scrape_cinema(int(cinema_id))

        if result["success"]:
            # Parse le JSON de chaque cinema
            cinema_json = json.loads(format_for_llm(result))
            all_cinemas.append(cinema_json)
            total_films += result.get("film_count", 0)
            total_filtered += result.get("films_filtered", 0)
            print(f"   [OK] {result['film_count']} films avec seances ({result.get('films_filtered', 0)} filtres)")
        else:
            print(f"   [ERREUR] {result.get('error')}")

    # Combine tous les cinemas dans un seul JSON (comme dans server.py)
    combined_data = {
        "cinemas": all_cinemas,
        "total_films": total_films,
        "total_filtered": total_filtered
    }

    # Sauvegarde
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_llm_filename = f"scraped_content_llm_multiple_{timestamp}.json"

    with open(json_llm_filename, 'w', encoding='utf-8') as f:
        json.dump(combined_data, f, indent=2, ensure_ascii=False)

    print(f"\n[FILE] JSON LLM combine sauvegarde: {json_llm_filename}")
    print(f"   - Total films avec seances: {total_films}")
    print(f"   - Films filtres: {total_filtered}")
    print(f"   - Nombre de cinemas: {len(all_cinemas)}")
    print(f"   - Taille: {len(json.dumps(combined_data, ensure_ascii=False))} caracteres")

    # Apercu
    print(f"\n{'-'*60}")
    print("[PREVIEW] Structure du JSON combine:")
    print(f"{'-'*60}")
    print(f"Cinemas: {len(all_cinemas)}")
    for cinema in all_cinemas:
        print(f"  - {cinema['cinema_name']}: {len(cinema['films'])} films")
    print(f"{'-'*60}\n")


def main():
    """Point d'entree principal"""
    import sys

    print("\n" + "="*60)
    print("[TEST SCRAPER UGC] - Generation scrapedContent")
    print("="*60)

    if len(sys.argv) > 1:
        # Mode CLI avec arguments
        cinema_ids = [int(id) for id in sys.argv[1:]]

        if len(cinema_ids) == 1:
            test_single_cinema(cinema_ids[0])
        else:
            test_multiple_cinemas(cinema_ids)
    else:
        # Mode interactif
        print("\nExemples de cinemas UGC:")
        print("  - 57: UGC Cine Cite Paris 19")
        print("  - 42: UGC Montparnasse")
        print("  - 8:  UGC Les Halles")
        print("  - 19: UGC George V")

        choice = input("\n1. Tester un seul cinema\n2. Tester plusieurs cinemas\nChoix (1/2): ").strip()

        if choice == "1":
            cinema_id = int(input("ID du cinema: "))
            cinema_name = input("Nom du cinema (optionnel): ").strip()
            test_single_cinema(cinema_id, cinema_name)

        elif choice == "2":
            ids_input = input("IDs des cinemas (separes par des espaces, ex: 57 42 8): ")
            cinema_ids = [int(id) for id in ids_input.split()]
            test_multiple_cinemas(cinema_ids)

        else:
            print("[ERREUR] Choix invalide")

    print("\n[OK] Test termine!\n")


if __name__ == "__main__":
    main()
