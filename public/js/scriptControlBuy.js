// 1. PRIMEIRO DECLARE TODAS AS CONSTANTES E VARIÁVEIS GLOBAIS
const acoesNota = {
  1: { 
      titulo: 'Confirmar Chegada', 
      mensagem: 'Deseja confirmar a chegada desta nota fiscal?',
      classe: 'btn-success',
      icone: 'bi-check-lg'
  },
  2: { 
      titulo: 'Confirmar Impressão Relatorio', 
      mensagem: 'Deseja confirmar a Impressão Do Relatorio desta nota fiscal?',
      classe: 'btn-success',
      icone: 'bi-check-lg'
  },
  3: { 
      titulo: 'Confirmar Precificação', 
      mensagem: 'Deseja confirmar a precificação desta nota fiscal?',
      classe: 'btn-success',
      icone: 'bi-check-lg'
  },
  4: { 
      titulo: 'Confirmar Lançamento', 
      mensagem: 'Deseja confirmar o lançamento desta nota fiscal?',
      classe: 'btn-success',
      icone: 'bi-check-lg'
  },
  5: { 
      titulo: 'Confirmar Pagamento', 
      mensagem: 'Deseja confirmar o pagamento desta nota fiscal?',
     classe: 'btn-success',
      icone: 'bi-check-lg'
  },
  6: { 
      titulo: 'Marcar como Divergente', 
      mensagem: 'Deseja marcar esta nota fiscal como divergente?',
      classe: 'btn-success',
      icone: 'bi-check-lg'
  }
};

const lojas = {
  '04023539000117': 'Exclusiva',
  '09666638000130': 'Util'
  // Adicione mais conforme necessário
};

// 2. DECLARE AS FUNÇÕES UTILITÁRIAS PRIMEIRO
function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toastContainer';
  container.className = 'position-fixed bottom-0 end-0 p-3';
  container.style.zIndex = '11';
  document.body.appendChild(container);
  return container;
}

function showToast(type, message) {
  const toastContainer = document.getElementById('toastContainer') || createToastContainer();
  const toastId = 'toast-' + Date.now();
  
  const toastHTML = `
      <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert">
          <div class="d-flex">
              <div class="toast-body">${message}</div>
              <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
          </div>
      </div>
  `;
  
  toastContainer.insertAdjacentHTML('beforeend', toastHTML);
  new bootstrap.Toast(document.getElementById(toastId)).show();
  
  setTimeout(() => {
      const toast = document.getElementById(toastId);
      if (toast) toast.remove();
  }, 5000);
}

// 3. DECLARE AS FUNÇÕES PRINCIPAIS
async function updateNota(chave, acao) {
  const config = acoesNota[acao];
  if (!config) {
      console.error('Ação não configurada:', acao);
      return;
  }

  const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
  const modalBody = document.getElementById('confirmModalBody');
  const confirmBtn = document.getElementById('confirmActionBtn');
  const modalTitle = document.querySelector('#confirmModal .modal-title');
  
  modalTitle.textContent = config.titulo;
  modalBody.innerHTML = `
      <p>${config.mensagem}</p>
      <p><strong>Chave:</strong> ${chave}</p>
  `;
  
  confirmBtn.className = `btn ${config.classe}`;
  confirmBtn.innerHTML = `<i class="bi ${config.icone}"></i> Confirmar`;
  
  confirmModal.show();
  
  return new Promise((resolve) => {
      const handleConfirm = async () => {
          try {
              confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';
              confirmBtn.disabled = true;
              
              const response = await fetch(`/api/notas-fiscais/${chave}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ acao })
              });

              const data = await response.json();
              if (!response.ok) throw new Error(data.error || 'Erro ao atualizar');

              confirmModal.hide();
              showToast('success', `${config.titulo} realizado com sucesso!`);
              switch (acao) {
                  case 1:
                        setTimeout(carregarNotasFiscais, 1000);
                      break;
                  case 2:
                    setTimeout(carregarNotasFiscais2, 1000);
                      break;
                  case 3:
                    setTimeout(carregarNotasFiscais3, 1000);
                      break;
                  case 4:
                    setTimeout(carregarNotasFiscais4, 1000);
                      break;
                  case 5:
                    setTimeout(carregarNotasFiscais5, 1000);
                      break;
                  
                  default:
                      break;
              }
              resolve(true);
              
          } catch (error) {
              showToast('danger', `Erro: ${error.message}`);
              resolve(false);
          } finally {
              confirmBtn.innerHTML = `<i class="bi ${config.icone}"></i> Confirmar`;
              confirmBtn.disabled = false;
              confirmBtn.removeEventListener('click', handleConfirm);
          }
      };
      
      confirmBtn.addEventListener('click', handleConfirm);
      confirmModal._element.addEventListener('hidden.bs.modal', () => {
          confirmBtn.removeEventListener('click', handleConfirm);
          resolve(false);
      });
  });
}

async function carregarNotasFiscais() {
    const divData = document.getElementById('tableData');
    const tabela = divData.querySelector('.table tbody');
    tabela.innerHTML = '<tr><td colspan="5" class="text-center">Carregando...</td></tr>';
  
    try {
        const response = await fetch('/api/notas-fiscais');
        const data = await response.json();
  
        if (!data.success || !data.data) {
            throw new Error(data.error || 'Dados inválidos recebidos');
        }
  
        if (data.data.length === 0) {
            tabela.innerHTML = '<tr><td colspan="5" class="text-center">Nenhuma nota fiscal encontrada</td></tr>';
            return;
        }
  
        tabela.innerHTML = '';
        
        data.data.forEach(nota => {
          console.log(nota);
          
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${nota.data}</td>
                <td>${nota.fornecedor || 'Não informado'}</td>
                <td>${nota.nota}</td>
                <td>R$ ${parseFloat(nota.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td>${lojas[nota.empresa] || nota.empresa || 'Não informado'}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="updateNota('${nota.chave}',1)">
                        <i class="bi bi-arrow-right-circle-fill"></i>
                    </button>
                </td>
            `;
            
            tabela.appendChild(row);
        });
  
    } catch (error) {
        console.error('Erro ao carregar notas:', error);
        tabela.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger">
                    Erro ao carregar notas: ${error.message}
                </td>
            </tr>
        `;
    }
}

async function carregarNotasFiscais2() {
  const tabela = document.querySelector('.table tbody');
  tabela.innerHTML = '<tr><td colspan="6" class="text-center">Carregando...</td></tr>';

  try {
      const response = await fetch('/api/notas-fiscais-entregues');
      const data = await response.json();

      if (!data.success || !data.data) {
          throw new Error(data.error || 'Dados inválidos recebidos');
      }

      if (data.data.length === 0) {
          tabela.innerHTML = '<tr><td colspan="7" class="text-center">Nenhuma nota fiscal encontrada</td></tr>';
          return;
      }

      tabela.innerHTML = '';
      
      data.data.forEach(nota => {
        console.log(nota);
        
          const row = document.createElement('tr');
          
          row.innerHTML = `
              <td>${nota.data}</td>
              <td>${nota.fornecedor || 'Não informado'}</td>
              <td>${nota.nota}</td>
              <td>R$ ${parseFloat(nota.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              
              <td>${lojas[nota.empresa] || nota.empresa || 'Não informado'}</td>
              <td>${nota.dt_chegada}</td>
              <td>

                  <button class="btn btn-sm btn-success" onclick="updateNota('${nota.chave}',2)">
                      <i class="bi bi-arrow-right-circle-fill"></i>
                  </button>
              </td>
              
          `;
          
          tabela.appendChild(row);
      });

  } catch (error) {
      console.error('Erro ao carregar notas:', error);
      tabela.innerHTML = `
          <tr>
              <td colspan="6" class="text-center text-danger">
                  Erro ao carregar notas: ${error.message}
              </td>
          </tr>
      `;
  }
}

async function carregarNotasFiscais3() {
  const tabela = document.querySelector('.table tbody');
  tabela.innerHTML = '<tr><td colspan="6" class="text-center">Carregando...</td></tr>';

  try {
      const response = await fetch('/api/notas-fiscais-aguardando-conf');
      const data = await response.json();

      if (!data.success || !data.data) {
          throw new Error(data.error || 'Dados inválidos recebidos');
      }

      if (data.data.length === 0) {
          tabela.innerHTML = '<tr><td colspan="5" class="text-center">Nenhuma nota fiscal encontrada</td></tr>';
          return;
      }

      tabela.innerHTML = '';
      
      data.data.forEach(nota => {
        console.log(nota);
        
          const row = document.createElement('tr');
          
          row.innerHTML = `
              <td>${nota.data_emiss}</td>
              <td>${nota.fornecedor || 'Não informado'}</td>
              <td>${nota.nota}</td>
              
              
              <td>${lojas[nota.empresa] || nota.empresa || 'Não informado'}</td>
              
              <td>

                  <button class="btn btn-sm btn-success" onclick="updateNota('${nota.chave}',3)">
                      <i class="bi bi-arrow-right-circle-fill"></i>
                  </button>
              </td>
              
          `;
          
          tabela.appendChild(row);
      });

  } catch (error) {
      console.error('Erro ao carregar notas:', error);
      tabela.innerHTML = `
          <tr>
              <td colspan="6" class="text-center text-danger">
                  Erro ao carregar notas: ${error.message}
              </td>
          </tr>
      `;
  }
}
async function carregarNotasFiscais4() {
  const tabela = document.querySelector('.table tbody');
  tabela.innerHTML = '<tr><td colspan="5" class="text-center">Carregando...</td></tr>';

  try {
      const response = await fetch('/api/notas-fiscais-aguardando-lancamento');
      const data = await response.json();

      if (!data.success || !data.data) {
          throw new Error(data.error || 'Dados inválidos recebidos');
      }

      if (data.data.length === 0) {
          tabela.innerHTML = '<tr><td colspan="5" class="text-center">Nenhuma nota fiscal encontrada</td></tr>';
          return;
      }

      tabela.innerHTML = '';
      
      data.data.forEach(nota => {
        console.log(nota);
        
          const row = document.createElement('tr');
          
          row.innerHTML = `
              <td>${nota.fornecedor}</td>
              <td>${nota.nota}</td>
              <td>${nota.chave}</td>
              <td>${lojas[nota.empresa] || nota.empresa || 'Não informado'}</td>
              <td>
                  <button class="btn btn-sm btn-success" onclick="updateNota('${nota.chave}',4)">                      <i class="bi bi-arrow-right-circle-fill"></i>
                  </button>
              </td>
              
          `;
          
          tabela.appendChild(row);
      });

  } catch (error) {
      console.error('Erro ao carregar notas:', error);
      tabela.innerHTML = `
          <tr>
              <td colspan="6" class="text-center text-danger">
                  Erro ao carregar notas: ${error.message}
              </td>
          </tr>
      `;
  }
}

async function carregarNotasFiscais5() {
  const divData = document.getElementById('tableData');
  const tabela = divData.querySelector('.table tbody');
  tabela.innerHTML = '<tr><td colspan="5" class="text-center">Carregando...</td></tr>';

  try {
      const response = await fetch('/api/notas-fiscais-precificadas');
      const data = await response.json();

      if (!data.success || !data.data) {
          throw new Error(data.error || 'Dados inválidos recebidos');
      }

      if (data.data.length === 0) {
          tabela.innerHTML = '<tr><td colspan="5" class="text-center">Nenhuma nota fiscal encontrada</td></tr>';
          return;
      }

      tabela.innerHTML = '';
      
      data.data.forEach(nota => {
        console.log(nota);
        
          const row = document.createElement('tr');
          
          row.innerHTML = `
              <td>${nota.fornecedor}</td>
              <td>${nota.nota}</td>
              <td>${lojas[nota.empresa] || nota.empresa || 'Não informado'}</td>
              <td>
                  <button class="btn btn-sm btn-success" onclick="updateNota('${nota.chave}',5)">                      <i class="bi bi-arrow-right-circle-fill"></i>
                  </button>
                  <button class="btn btn-sm btn-success" onclick="visualizarNota('${nota.chave}')">                     <i class="bi bi-eye-fill"></i>

                  </button>
              </td> 
                  
              
          `;
          
          tabela.appendChild(row);
      });

  } catch (error) {
      console.error('Erro ao carregar notas:', error);
      tabela.innerHTML = `
          <tr>
              <td colspan="6" class="text-center text-danger">
                  Erro ao carregar notas: ${error.message}
              </td>
          </tr>
      `;
  }
}
// 4. EVENT LISTENERS E INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', function() {  
  // Configura o formulário de upload
  document.getElementById('uploadForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const fileInput = document.getElementById('importForm');
      const statusModal = new bootstrap.Modal(document.getElementById('statusModal'));
      const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
      const modalBody = document.getElementById('modalBodyContent');
      const closeButton = document.querySelector('#statusModal .btn-secondary');
    
      closeButton.onclick = function() {
          statusModal.hide();
      };
    
      if (fileInput.files.length === 0) {
          modalBody.innerHTML = `
              <div class="alert alert-warning d-flex align-items-center">
                  <i class="bi bi-exclamation-triangle-fill me-2"></i>
                  <div>Por favor, selecione um arquivo para importar.</div>
              </div>
          `;
          statusModal.show();
          return;
      }
    
      const formData = new FormData();
      formData.append('planilha', fileInput.files[0]);
    
      try {
          loadingModal.show();
          const response = await fetch('/api/importar-nfe', {
              method: 'POST',
              body: formData
          });
      
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
              const text = await response.text();
              throw new Error(text || 'Resposta inválida do servidor');
          }
      
          const data = await response.json();
      
          if (!response.ok) {
              throw new Error(data.error || 'Erro ao processar arquivo');
          }
      
          modalBody.innerHTML = `
              <div class="alert alert-success d-flex align-items-center">
                  <i class="bi bi-check-circle-fill me-2"></i>
                  <div>
                      <h6>${data.message || 'Arquivo processado com sucesso!'}</h6>
                      ${data.registrosInseridos ? `<p class="mb-0">Registros inseridos: ${data.registrosInseridos}/${data.totalRegistros}</p>` : ''}
                  </div>
              </div>
          `;
          
          fileInput.value = '';
          carregarNotasFiscais(); // Atualiza a tabela após importação
          
      } catch (error) {
          console.error('Erro na importação:', error);
          
          modalBody.innerHTML = `
              <div class="alert alert-danger d-flex align-items-center">
                  <i class="bi bi-exclamation-octagon-fill me-2"></i>
                  <div>
                      <h6>Erro no Processamento</h6>
                      <p class="mb-0">${error.message || 'Ocorreu um erro durante a importação.'}</p>
                  </div>
              </div>
          `;
          
          const modalFooter = document.querySelector('#statusModal .modal-footer');
          modalFooter.innerHTML = `
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
              <button type="button" class="btn btn-primary" onclick="document.getElementById('uploadForm').requestSubmit()">Tentar Novamente</button>
          `;
          
      } finally {
          loadingModal.hide();
          statusModal.show();
      }
  });
});

async function visualizarNota(notaId) {
    const modal = new bootstrap.Modal(document.getElementById("modalVisualizarNota"));
    const modalTitle = document.getElementById("modalVisualizarNotaLabel");
    const loader = document.getElementById("loaderNota");
    const tabela = document.getElementById("notaTable");
    const tbody = tabela.querySelector('tbody');
    
    // Configuração inicial do modal
    modalTitle.textContent = `Detalhes da Nota Fiscal`;
    tbody.innerHTML = '';
    loader.style.display = 'block';
    tabela.style.display = 'none';
    
    modal.show();
  
    try {
        const response = await fetch(`/api/nota-precificada/${notaId}`);
        if (!response.ok) throw new Error(`Erro ${response.status}: ${response.statusText}`);

        const data = await response.json();
        if (!data.data || !Array.isArray(data.data)) throw new Error("Dados inválidos");

        // Preenche a tabela com os itens da nota
        data.data.forEach((item, index) => {
            const row = document.createElement('tr');
            
            const precoFormatado = item.preco ? 
                parseFloat(item.preco).toLocaleString('pt-BR', { 
                    style: 'currency', 
                    currency: 'BRL' 
                }) : 'R$ 0,00';
            
            row.innerHTML = `
                <td data-label="Produto">${item.produto || 'N/A'}</td>
                <td data-label="Referência">${item.referencia || 'N/A'}</td>
                <td data-label="Código Barras">${item.cod_barra || 'N/A'}</td>             
                <td data-label="Preço" class="text-end">${precoFormatado}</td>
                <td data-label="Local">${item.local || 'N/A'}</td>
            `;
            
            if (index % 2 === 0) row.classList.add('bg-light');
            tbody.appendChild(row);
        });

        loader.style.display = 'none';
        tabela.style.display = 'table';
        
    } catch (error) {
        console.error("Erro ao visualizar nota:", error);
        loader.style.display = 'none';
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-danger">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                    Erro ao carregar: ${error.message}
                </td>
            </tr>
        `;
        tabela.style.display = 'table';
    }
}

// 4. EVENT LISTENERS
document.addEventListener('DOMContentLoaded', function() {
    // Configura o formulário de upload
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async function(e) {
            // ... (mantenha a implementação existente)
        });
    }
});