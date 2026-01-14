import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MCPClient {
  constructor() {
    // ⭐ Pointe vers le script Python
    this.mcpServerPath = path.join(__dirname, '../../mcp-server/server.py');
    this.pythonPath = 'python3'; // ou 'python' selon ton système
    this.requestId = 0;
  }
  
  /**
   * Exécute un tool via le MCP Server Python
   */
  async callTool(toolName, toolArgs) {
    return new Promise((resolve, reject) => {
      console.log(`🔧 [MCP Client] Calling Python tool: ${toolName}`, toolArgs);
      
      // ⭐ Spawn du process Python
      const mcpProcess = spawn(this.pythonPath, [this.mcpServerPath]);
      
      let stdout = '';
      let stderr = '';
      
      mcpProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      mcpProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        // Affiche les logs Python en temps réel
        console.log('[Python stderr]', data.toString().trim());
      });
      
      // Envoie la requête JSON-RPC via stdin
      this.requestId++;
      const mcpRequest = {
        jsonrpc: '2.0',
        id: this.requestId,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: toolArgs
        }
      };
      
      mcpProcess.stdin.write(JSON.stringify(mcpRequest) + '\n');
      mcpProcess.stdin.end();
      
      mcpProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('❌ Python MCP stderr:', stderr);
          return reject(new Error(`Python MCP process exited with code ${code}`));
        }
        
        try {
          // Parse la réponse JSON-RPC
          const lines = stdout.trim().split('\n').filter(line => {
            try {
              const parsed = JSON.parse(line);
              return parsed.jsonrpc === '2.0';
            } catch {
              return false;
            }
          });
          
          if (lines.length === 0) {
            return reject(new Error('No valid JSON-RPC response from Python MCP'));
          }
          
          const response = JSON.parse(lines[lines.length - 1]);
          
          if (response.error) {
            return reject(new Error(response.error.message || 'Python MCP error'));
          }
          
          if (response.result && response.result.content) {
            resolve(response.result.content[0].text);
          } else {
            reject(new Error('Invalid Python MCP response structure'));
          }
        } catch (error) {
          console.error('❌ Error parsing Python MCP response:', error);
          console.error('Raw stdout:', stdout);
          reject(error);
        }
      });
      
      // Timeout de 15 minutes (scraping de tous les cinémas peut être très long)
      setTimeout(() => {
        mcpProcess.kill();
        reject(new Error('Python MCP tool execution timeout'));
      }, 900000); // 15 minutes
    });
  }
  
  /**
   * Scrape un cinéma UGC spécifique
   */
  async scrapeUGCCinema(cinemaId, cinemaName = '') {
    try {
      const result = await this.callTool('scrape_ugc_cinema', {
        cinema_id: String(cinemaId),
        cinema_name: cinemaName
      });
      
      return {
        success: true,
        cinemaId,
        content: result
      };
    } catch (error) {
      console.error(`❌ Erreur scraping cinéma ${cinemaId}:`, error.message);
      return {
        success: false,
        cinemaId,
        error: error.message
      };
    }
  }
  
  /**
   * Scrape plusieurs cinémas en séquence
   */
  async scrapeMultipleCinemas(cinemaIds) {
    try {
      const result = await this.callTool('scrape_multiple_ugc_cinemas', {
        cinema_ids: cinemaIds.map(String)
      });
      
      return {
        success: true,
        content: result
      };
    } catch (error) {
      console.error('❌ Erreur scraping multiple:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new MCPClient();