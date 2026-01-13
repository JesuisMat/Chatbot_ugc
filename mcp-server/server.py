#!/usr/bin/env python3
"""
MCP Server Python pour le scraping UGC
Communication via stdin/stdout (JSON-RPC 2.0)
"""
import sys
import json
from scraper_ugc import scraper

def handle_list_tools():
    """Retourne la liste des tools disponibles"""
    return {
        "tools": [
            {
                "name": "scrape_ugc_cinema",
                "description": """Scrape la page UGC d'un cinéma spécifique pour obtenir la programmation complète.
Retourne : films à l'affiche avec titre, genre, durée, réalisateur, acteurs, horaires.""",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "cinema_id": {
                            "type": "string",
                            "description": "ID du cinéma UGC (ex: '57', '42')"
                        },
                        "cinema_name": {
                            "type": "string",
                            "description": "Nom du cinéma (optionnel)"
                        }
                    },
                    "required": ["cinema_id"]
                }
            },
            {
                "name": "scrape_multiple_ugc_cinemas",
                "description": "Scrape plusieurs cinémas UGC en séquence.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "cinema_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Liste des IDs de cinémas UGC"
                        }
                    },
                    "required": ["cinema_ids"]
                }
            }
        ]
    }

def handle_call_tool(tool_name, arguments):
    """Exécute un tool et retourne le résultat"""
    try:
        if tool_name == "scrape_ugc_cinema":
            cinema_id = int(arguments.get("cinema_id"))
            cinema_name = arguments.get("cinema_name", "")
            
            # Log vers stderr (stdout réservé au JSON-RPC)
            print(f"[MCP Python] Scraping cinema {cinema_id}...", file=sys.stderr)
            
            result = scraper.scrape_cinema(cinema_id, cinema_name)
            
            if not result["success"]:
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": f"❌ Erreur scraping cinéma {cinema_id}: {result.get('error')}"
                        }
                    ]
                }
            
            # Formate le JSON pour le LLM
            formatted_text = format_for_llm(result)
            
            return {
                "content": [
                    {
                        "type": "text",
                        "text": formatted_text
                    }
                ]
            }
        
        elif tool_name == "scrape_multiple_ugc_cinemas":
            cinema_ids = arguments.get("cinema_ids", [])

            print(f"[MCP Python] Scraping {len(cinema_ids)} cinémas...", file=sys.stderr)

            all_cinemas = []
            total_films = 0
            total_filtered = 0

            for cinema_id in cinema_ids:
                result = scraper.scrape_cinema(int(cinema_id))
                if result["success"]:
                    # Parse le JSON de chaque cinéma
                    cinema_json = json.loads(format_for_llm(result))
                    all_cinemas.append(cinema_json)
                    total_films += result.get("film_count", 0)
                    total_filtered += result.get("films_filtered", 0)
                    print(f"[MCP Python] Cinéma {cinema_id}: {result['film_count']} films avec séances ({result.get('films_filtered', 0)} filtrés)", file=sys.stderr)

            print(f"[MCP Python] Total: {total_films} films avec séances, {total_filtered} films sans séances filtrés", file=sys.stderr)

            # Combine tous les cinémas dans un seul JSON
            combined_data = {
                "cinemas": all_cinemas,
                "total_films": total_films,
                "total_filtered": total_filtered
            }

            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(combined_data, ensure_ascii=False, separators=(',', ':')) if all_cinemas else "❌ Aucun cinéma n'a pu être scrapé"
                    }
                ]
            }
        
        else:
            raise ValueError(f"Tool inconnu: {tool_name}")
    
    except Exception as e:
        print(f"[MCP Python] Erreur: {e}", file=sys.stderr)
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"❌ Erreur lors de l'exécution: {str(e)}"
                }
            ],
            "isError": True
        }

def format_for_llm(result: dict) -> str:
    """
    Formate les données scrapées en JSON structuré optimisé pour le LLM

    Retourne un JSON compact avec:
    - Infos cinéma
    - Liste des films avec métadonnées
    - Séances groupées par date (limité à 3 prochaines dates)
    """
    cinema = result["cinema"]
    films = result["films"]

    # Conversion de la durée en minutes (ex: "2h43" -> 163)
    def parse_duration(duration_str):
        if not duration_str:
            return None
        # Format: "2h43" ou "1h30"
        import re
        match = re.match(r"(\d+)h(\d+)?", duration_str)
        if match:
            hours = int(match.group(1))
            minutes = int(match.group(2)) if match.group(2) else 0
            return hours * 60 + minutes
        return None

    # Séparation des acteurs en liste
    def parse_actors(actors_str):
        if not actors_str:
            return []
        return [a.strip() for a in actors_str.split(',')]

    # Construction du JSON structuré
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

        # Horaires (limité aux 3 prochaines dates)
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

def handle_request(request):
    """
    Traite une requête JSON-RPC et retourne la réponse
    """
    method = request.get("method")
    params = request.get("params", {})
    request_id = request.get("id")
    
    try:
        if method == "tools/list":
            result = handle_list_tools()
        
        elif method == "tools/call":
            tool_name = params.get("name")
            arguments = params.get("arguments", {})
            result = handle_call_tool(tool_name, arguments)
        
        else:
            raise ValueError(f"Méthode inconnue: {method}")
        
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": result
        }
    
    except Exception as e:
        print(f"[MCP Python] Erreur traitement: {e}", file=sys.stderr)
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {
                "code": -32603,
                "message": str(e)
            }
        }

def main():
    """
    Boucle principale : lit stdin, traite les requêtes, écrit sur stdout
    """
    print("[MCP Python] Server started on stdin/stdout", file=sys.stderr)
    
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        
        try:
            request = json.loads(line)
            response = handle_request(request)
            
            # Écrit la réponse sur stdout (JSON-RPC)
            print(json.dumps(response), flush=True)
        
        except json.JSONDecodeError as e:
            print(f"[MCP Python] Invalid JSON: {e}", file=sys.stderr)
            error_response = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32700,
                    "message": "Parse error"
                }
            }
            print(json.dumps(error_response), flush=True)

if __name__ == "__main__":
    main()