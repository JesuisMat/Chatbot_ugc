"""
UGC Cinema Scraper - Version adaptée pour MCP
"""
import requests
import re
import json
import time
from bs4 import BeautifulSoup
from typing import Dict, List, Optional

class UGCScraper:
    def __init__(self):
        self.ugc_ajax_url = (
            "https://www.ugc.fr/showingsCinemaAjaxAction!getShowingsForCinemaPage.action"
        )
        self.headers = {
            "User-Agent": "Mozilla/5.0",
            "X-Requested-With": "XMLHttpRequest",
        }
    
    def scrape_cinema(self, cinema_id: int, cinema_name: str = "") -> Dict:
        """
        Scrape un cinéma UGC et retourne un JSON structuré
        
        Args:
            cinema_id: ID du cinéma UGC (ex: 57)
            cinema_name: Nom du cinéma (optionnel)
        
        Returns:
            Dict avec clés: success, cinema, films, error
        """
        try:
            cinema_page_url = f"https://www.ugc.fr/cinema.html?id={cinema_id}"
            
            # STEP 1: Récupère les dates disponibles
            available_dates = self._get_available_dates(cinema_page_url)
            
            if not available_dates:
                return {
                    "success": False,
                    "cinema_id": cinema_id,
                    "error": "Aucune date disponible trouvée"
                }
            
            # STEP 2: Scrape les films pour chaque date
            film_index = {}
            
            for date_str in available_dates[:7]:  # Limite à 7 jours
                daily_films = self._scrape_day(cinema_id, date_str)
                
                for film in daily_films:
                    fid = film["film_id"]
                    
                    if fid not in film_index:
                        film_index[fid] = film
                    else:
                        # Fusionne les horaires
                        film_index[fid]["showings"].update(film["showings"])
                
                time.sleep(0.3)  # Polite scraping
            
            # ⭐ Filtre: ne garde que les films avec au moins une séance programmée
            films_with_showings = [
                film for film in film_index.values()
                if film["showings"] and len(film["showings"]) > 0
            ]

            return {
                "success": True,
                "cinema": {
                    "id": cinema_id,
                    "name": cinema_name or f"UGC Cinéma {cinema_id}"
                },
                "available_dates": available_dates[:7],
                "films": films_with_showings,
                "film_count": len(films_with_showings),
                "total_films_scraped": len(film_index),
                "films_filtered": len(film_index) - len(films_with_showings)
            }
            
        except Exception as e:
            return {
                "success": False,
                "cinema_id": cinema_id,
                "error": str(e)
            }
    
    def _get_available_dates(self, cinema_page_url: str) -> List[str]:
        """Extrait les dates disponibles depuis la page principale"""
        r = requests.get(cinema_page_url, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        
        soup = BeautifulSoup(r.text, "html.parser")
        dates = []
        
        for div in soup.select("div[id^='nav_date_']"):
            date_str = div["id"].replace("nav_date_", "")
            dates.append(date_str)
        
        return sorted(set(dates))
    
    def _scrape_day(self, cinema_id: int, date_str: str) -> List[Dict]:
        """Scrape les films pour une date donnée (via AJAX)"""
        params = {
            "cinemaId": cinema_id,
            "date": date_str,
            "page": 30007,
            "searchFilmKey": "",
        }
        
        r = requests.get(self.ugc_ajax_url, params=params, headers=self.headers)
        r.raise_for_status()
        
        soup = BeautifulSoup(r.text, "html.parser")
        films = []
        
        for film_block in soup.select("div.component--film-presentation"):
            title_tag = film_block.select_one(".block--title a")
            rating_tag = film_block.select_one("h1.average")
            
            if not title_tag:
                continue
            
            # Genre + durée
            raw_genre_duration = None
            for p in film_block.select("p"):
                txt = p.get_text(strip=True)
                if "(" in txt and "h" in txt:
                    raw_genre_duration = txt
                    break
            
            genre, duration = self._extract_genre_and_duration(raw_genre_duration)
            
            film = {
                "film_id": title_tag["href"].split("_")[-1].split(".")[0],
                "title": title_tag.get_text(strip=True),
                "genre": genre,
                "duration": duration,
                "director": self._extract_from_p(film_block, "De"),
                "actors": self._extract_from_p(film_block, "Avec"),
                "rating": (
                    float(rating_tag.get_text().replace(",", ".")) 
                    if rating_tag else None
                ),
                "release_date": self._extract_from_p(film_block, "Sortie le"),
                "showings": {},
            }
            
            # Horaires
            screenings_ul = film_block.find_next("ul", class_="component--screening-cards")
            
            if screenings_ul:
                film["showings"][date_str] = []
                for btn in screenings_ul.select("button[data-seancehour]"):
                    end_div = btn.select_one(".screening-end")
                    film["showings"][date_str].append({
                        "start": btn.get("data-seancehour"),
                        "end": self._extract_end_time(
                            end_div.get_text() if end_div else None
                        ),
                        "version": btn.get("data-version"),
                    })
            
            films.append(film)
        
        return films
    
    def _extract_from_p(self, block, keyword: str) -> Optional[str]:
        """Extrait le texte d'un <p> contenant un mot-clé"""
        for p in block.select("p"):
            if keyword in p.get_text():
                span = p.find("span", class_="color--dark-blue")
                return span.get_text(strip=True) if span else None
        return None
    
    def _extract_genre_and_duration(self, text: str) -> tuple:
        """Extrait 'Action, Drame (2h43)' → ('Action, Drame', '2h43')"""
        if not text:
            return None, None
        
        match = re.search(r"^(.*?)\s*\(([^)]+)\)", text)
        if match:
            return match.group(1).strip(), match.group(2).strip()
        
        return None, None
    
    def _extract_end_time(self, text: str) -> Optional[str]:
        """Extrait '(fin 20:05)' → '20:05'"""
        if not text:
            return None
        match = re.search(r"(\d{2}:\d{2})", text)
        return match.group(1) if match else None


# Instance globale
scraper = UGCScraper()