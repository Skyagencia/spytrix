const linhas = [
    "[INFO] Conexão segura iniciada...",
    "[INFO] Autenticando número de telefone...",
    "[INFO] Capturando imagens enviadas...",
    "[ALERTA] Mensagem excluída detectada...",
    "[SUCESSO] Dados sincronizados com backup oculto."
  ];
  
  let delay = 0;
  const container = document.getElementById("terminal");
  
  linhas.forEach((linha) => {
    setTimeout(() => {
      const el = document.createElement("p");
      el.textContent = linha;
      container.appendChild(el);
    }, delay);
    delay += 1200;
  });
  