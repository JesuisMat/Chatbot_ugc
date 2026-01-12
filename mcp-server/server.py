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
            
            all_results = []
            for cinema_id in cinema_ids:
                result = scraper.scrape_cinema(int(cinema_id))
                if result["success"]:
                    all_results.append(format_for_llm(result))
            
            combined = "\n\n---\n\n".join(all_results)
            
            return {
                "content": [
                    {
                        "type": "text",
                        "text": combined or "❌ Aucun cinéma n'a pu être scrapé"
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
    Formate le JSON en texte lisible pour le LLM
    """
    cinema = result["cinema"]
    films = result["films"]
    
    lines = [f"# {cinema['name']}"]
    lines.append(f"\n**Films à l'affiche** ({len(films)} films):\n")
    
    for i, film in enumerate(films, 1):
        lines.append(f"## {i}. {film['title']}")
        
        if film.get("genre"):
            lines.append(f"- **Genre**: {film['genre']}")
        
        if film.get("duration"):
            lines.append(f"- **Durée**: {film['duration']}")
        
        if film.get("director"):
            lines.append(f"- **Réalisateur**: {film['director']}")
        
        if film.get("actors"):
            lines.append(f"- **Acteurs**: {film['actors']}")
        
        if film.get("rating"):
            lines.append(f"- **Note**: {film['rating']}/5")
        
        # Horaires (uniquement les 3 prochaines dates)
        if film.get("showings"):
            dates = sorted(film["showings"].keys())[:3]
            for date in dates:
                seances = film["showings"][date]
                horaires = [s["start"] for s in seances[:5]]  # Max 5 horaires
                if horaires:
                    lines.append(f"- **{date}**: {', '.join(horaires)}")
        
        lines.append("")  # Ligne vide
    
    return "\n".join(lines)

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