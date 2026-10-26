# Materiais Loghus

Site para os professores do Curso Loghus colocarem listas de exercícios e apresentações no layout padrão do curso.

- **Lista de exercícios:** importa do Word (.docx) ou de texto colado, separa questões, alternativas, imagens e fórmulas, e gera o **PDF** (e o Word) no modelo da lista (cabeçalho com logo, duas colunas, Times 12).
- **Apresentação:** monta slides (capa, divisória, tópicos, texto + imagem, imagem, questão com slide de resposta e resolução) e gera o **PowerPoint** a partir do modelo "Aulão Loghus".

Tudo roda no navegador do professor: nada é enviado para servidor e não precisa de login. O rascunho fica salvo no próprio navegador; "Salvar projeto" baixa um arquivo `.loghus` para continuar em outro computador.

## Publicar no GitHub Pages

1. Crie um repositório (ex.: `materiais`) e envie **todo o conteúdo desta pasta** (o `index.html` precisa ficar na raiz).
2. Em *Settings → Pages*, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. O endereço fica `https://<usuario>.github.io/materiais/`.

## Trocar os modelos

Os modelos originais ficam em `assets/` (`modelo-lista.docx`, `modelo-slides.pptx`) e também embutidos em `js/modelos.js` (para funcionar offline). Se o modelo mudar, peça ao Claude para regenerar os dois.

Fontes incluídas: Liberation Serif/Sans e Carlito (licença SIL OFL), com as mesmas medidas de Times New Roman, Helvetica/Arial e Calibri.
