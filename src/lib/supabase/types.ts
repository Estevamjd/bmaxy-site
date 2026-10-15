/**
 * Tipos do banco mantidos junto das migrations em `supabase/migrations`.
 * O projeto hospedado existe; ao alterar o schema, regenere e confira o diff:
 *   npx supabase gen types typescript --project-id qlrljzodmisvohjeodxt
 */

export type UserRole = "student" | "admin";
export type CourseStatus = "draft" | "published";
export type LessonStatus = "draft" | "coming_soon" | "published";
export type EnrollmentStatus = "active" | "revoked";
export type EnrollmentSource = "manual" | "payment" | "signup";
export type VideoProvider = "youtube";

/**
 * CATÁLOGO DE LIVROS.
 *
 * `archived` existe no lugar de exclusão: o painel não apaga livro. Um título
 * arquivado sai da vitrine e continua no banco, com slug, capa e sinopses
 * intactos — o erro que se quer evitar é o irreversível, não o reversível.
 */
export type BookStatus = "draft" | "published" | "archived";

/** As duas lojas reais. Não é lista aberta: o CHECK do banco também recusa. */
export type BookStore = "amazon" | "clube_de_autores";

/** Os dois idiomas do catálogo — mesmo par de `src/content/site.ts`. */
export type Locale = "pt" | "en";

/** Também é o retorno de complete_lesson() — mesma forma de linha. */
export type LessonProgressRow = {
  id: string;
  user_id: string;
  lesson_id: string;
  watched_seconds: number;
  duration_seconds: number | null;
  percent_complete: number;
  completed: boolean;
  completed_at: string | null;
  last_position_seconds: number;
  created_at: string;
  updated_at: string;
};

/**
 * ESTÚDIO DE ESCRITA — o dado mais sensível do sistema.
 *
 * `word_count` NÃO aparece em Insert nem em Update: quem calcula é o trigger
 * do banco, a partir do `content`. Deixá-lo fora do tipo é a forma de o
 * TypeScript avisar quem tentar enviá-lo, antes de o Postgres recusar com
 * 42501.
 *
 * `user_id` também fica fora do Update pelo mesmo motivo — transferir um
 * capítulo para outra conta não é uma operação que exista.
 */
export type WritingProjectRow = {
  id: string;
  user_id: string;
  title: string;
  genre: string;
  description: string;
  word_goal: number | null;
  created_at: string;
  updated_at: string;
  shared_for_review_at: string | null;
};

export type WritingChapterRow = {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  content: string;
  order_index: number;
  word_count: number;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          locale: "pt" | "en";
          must_change_password: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          locale?: "pt" | "en";
          must_change_password?: boolean;
        };
        Update: {
          full_name?: string;
          locale?: "pt" | "en";
          must_change_password?: boolean;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role: UserRole;
        };
        Update: {
          role?: UserRole;
        };
        Relationships: [];
      };
      courses: {
        Row: {
          id: string;
          slug: string;
          title_pt: string;
          title_en: string;
          description_pt: string;
          description_en: string;
          status: CourseStatus;
          cover_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          slug: string;
          title_pt: string;
          title_en: string;
          description_pt?: string;
          description_en?: string;
          status?: CourseStatus;
          cover_url?: string | null;
        };
        Update: {
          slug?: string;
          title_pt?: string;
          title_en?: string;
          description_pt?: string;
          description_en?: string;
          status?: CourseStatus;
          cover_url?: string | null;
        };
        Relationships: [];
      };
      course_modules: {
        Row: {
          id: string;
          course_id: string;
          title_pt: string;
          title_en: string;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          course_id: string;
          title_pt: string;
          title_en: string;
          order_index?: number;
        };
        Update: {
          title_pt?: string;
          title_en?: string;
          order_index?: number;
        };
        Relationships: [];
      };
      lessons: {
        Row: {
          id: string;
          module_id: string;
          title_pt: string;
          title_en: string;
          description_pt: string;
          description_en: string;
          order_index: number;
          status: LessonStatus;
          /**
           * video_provider e video_id NÃO moram mais aqui — saíram para
           * public.lesson_media, que RLS não deixa ninguém ler pela API
           * (migration 20260803202703_private_lesson_media.sql). Este booleano
           * é o que sobra de público: dizer que EXISTE vídeo não entrega o
           * vídeo, e a interface precisa disso para escolher entre o player e
           * o aviso "em breve".
           */
          has_video: boolean;
          duration_seconds: number | null;
          is_preview: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          module_id: string;
          title_pt: string;
          title_en: string;
          description_pt?: string;
          description_en?: string;
          order_index?: number;
          status?: LessonStatus;
          duration_seconds?: number | null;
          is_preview?: boolean;
        };
        Update: {
          title_pt?: string;
          title_en?: string;
          description_pt?: string;
          description_en?: string;
          order_index?: number;
          status?: LessonStatus;
          duration_seconds?: number | null;
          is_preview?: boolean;
        };
        Relationships: [];
      };
      /**
       * Tabela privada: RLS ligada e sem policy nenhuma, então anon e
       * authenticated não leem nada aqui. Só alcançam a service_role (painel
       * administrativo) e as funções security definer. O aluno obtém estes
       * dados exclusivamente por get_lesson_playback().
       */
      lesson_media: {
        Row: {
          lesson_id: string;
          video_provider: VideoProvider;
          video_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          lesson_id: string;
          video_provider: VideoProvider;
          video_id: string;
        };
        Update: {
          video_provider?: VideoProvider;
          video_id?: string;
        };
        Relationships: [];
      };
      enrollments: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          status: EnrollmentStatus;
          source: EnrollmentSource;
          granted_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          course_id: string;
          status?: EnrollmentStatus;
          source?: EnrollmentSource;
          granted_by?: string | null;
        };
        Update: {
          status?: EnrollmentStatus;
          source?: EnrollmentSource;
          granted_by?: string | null;
        };
        Relationships: [];
      };
      lesson_progress: {
        Row: LessonProgressRow;
        Insert: {
          user_id: string;
          lesson_id: string;
          watched_seconds?: number;
          duration_seconds?: number | null;
          percent_complete?: number;
          completed?: boolean;
          completed_at?: string | null;
          last_position_seconds?: number;
        };
        Update: {
          watched_seconds?: number;
          duration_seconds?: number | null;
          percent_complete?: number;
          completed?: boolean;
          completed_at?: string | null;
          last_position_seconds?: number;
        };
        Relationships: [];
      };
      writing_projects: {
        Row: WritingProjectRow;
        Insert: {
          user_id: string;
          title?: string;
          genre?: string;
          description?: string;
          word_goal?: number | null;
        };
        Update: {
          title?: string;
          genre?: string;
          description?: string;
          word_goal?: number | null;
        };
        Relationships: [];
      };
      writing_chapters: {
        Row: WritingChapterRow;
        Insert: {
          project_id: string;
          user_id: string;
          title?: string;
          content?: string;
          order_index?: number;
        };
        Update: {
          title?: string;
          content?: string;
          order_index?: number;
        };
        Relationships: [];
      };
      books: {
        Row: {
          id: string;
          slug: string;
          title: string;
          status: BookStatus;
          order_index: number;
          print_price_cents: number | null;
          ebook_price_cents: number | null;
          cover_path: string;
          cover_width: number | null;
          cover_height: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          slug: string;
          title: string;
          status?: BookStatus;
          order_index?: number;
          print_price_cents?: number | null;
          ebook_price_cents?: number | null;
          cover_path?: string;
          cover_width?: number | null;
          cover_height?: number | null;
        };
        Update: {
          slug?: string;
          title?: string;
          status?: BookStatus;
          order_index?: number;
          print_price_cents?: number | null;
          ebook_price_cents?: number | null;
          cover_path?: string;
          cover_width?: number | null;
          cover_height?: number | null;
        };
        Relationships: [];
      };
      book_localizations: {
        Row: {
          book_id: string;
          locale: Locale;
          synopsis: string;
          cover_alt: string;
          updated_at: string;
        };
        Insert: {
          book_id: string;
          locale: Locale;
          synopsis?: string;
          cover_alt?: string;
        };
        /* `book_id` e `locale` ficam de fora: são a chave primária, e o GRANT
           de UPDATE cobre só synopsis e cover_alt. Mover uma sinopse de livro
           não é uma operação que exista. */
        Update: {
          synopsis?: string;
          cover_alt?: string;
        };
        /* Não é decoração: é daqui que o supabase-js infere o tipo do join
           aninhado `books(..., book_localizations(...))`. Sem esta entrada, a
           consulta compila como SelectQueryError e o resultado vira `never`. */
        Relationships: [
          {
            foreignKeyName: "book_localizations_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
        ];
      };
      book_store_links: {
        Row: {
          book_id: string;
          store: BookStore;
          url: string;
          updated_at: string;
        };
        Insert: {
          book_id: string;
          store: BookStore;
          url: string;
        };
        Update: {
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "book_store_links_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_settings: {
        /**
         * `brl_per_usd` é `numeric(10,4)` no banco e chega aqui como `number`
         * — o PostgREST serializa numeric como número JSON, e 5.1 não existe
         * em ponto flutuante binário.
         *
         * Por isso a DAL seleciona `brl_per_usd::text` e o tipo declara
         * `string`: a leitura tem que ser exata antes de `src/lib/money.ts`
         * poder trabalhar. Declarar `number` aqui convidaria alguém a
         * `select("brl_per_usd")` sem o cast e a perder precisão em silêncio.
         */
        Row: {
          id: true;
          brl_per_usd: string;
          updated_at: string;
          updated_by: string | null;
        };
        /* Sem Insert: a linha única nasce na migration e a policy de INSERT
           não existe. Uma segunda linha é recusada com 42501. */
        Insert: never;
        Update: {
          brl_per_usd?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      complete_lesson: {
        Args: { p_lesson_id: string };
        Returns: LessonProgressRow;
      };
      create_writing_project: {
        Args: { p_project_title: string; p_initial_chapter_title: string };
        Returns: string;
      };
      create_writing_chapter: {
        Args: { p_project_id: string; p_title: string };
        Returns: string;
      };
      move_writing_chapter: {
        Args: { p_chapter_id: string; p_direction: "up" | "down" };
        Returns: boolean;
      };
      /**
       * Única porta pela qual um aluno obtém o ID do vídeo. Valida
       * autenticação, matrícula ativa, curso e aula publicados e conclusão de
       * todas as aulas publicadas anteriores antes de devolver qualquer coisa;
       * do contrário levanta exceção. `returns table(...)`, por isso o retorno
       * é uma LISTA (vazia quando a aula não tem mídia cadastrada).
       */
      /**
       * Trocam de posição com o vizinho imediato, dentro de uma transação só
       * (o unique (course_id|module_id, order_index) impede a troca em um
       * passo). `false` = já é o primeiro/último; não é erro.
       * Ver 20260803221619_admin_content_ordering.sql.
       */
      move_module: {
        Args: { p_module_id: string; p_direction: "up" | "down" };
        Returns: boolean;
      };
      move_lesson: {
        Args: { p_lesson_id: string; p_direction: "up" | "down" };
        Returns: boolean;
      };
      /**
       * Criam módulo/aula calculando a posição DENTRO do mesmo comando que
       * grava a linha, com advisory lock no pai para serializar criações
       * concorrentes. Devolvem o id do que foi criado.
       *
       * A aula nasce sempre como rascunho — por isso `status` não é
       * parâmetro. Ver 20260804201803_atomic_content_creation.sql.
       */
      create_module: {
        Args: { p_course_id: string; p_title_pt: string; p_title_en: string };
        Returns: string;
      };
      create_lesson: {
        Args: { p_module_id: string; p_title_pt: string; p_title_en: string };
        Returns: string;
      };
      /**
       * OBSOLETAS. Leem `max(order_index) + 1` e devolvem o número para um
       * INSERT separado — entre a leitura e a escrita cabe outra transação.
       * Continuam existindo para não quebrar chamador antigo; código novo usa
       * create_module/create_lesson.
       */
      next_module_order: {
        Args: { p_course_id: string };
        Returns: number;
      };
      next_lesson_order: {
        Args: { p_module_id: string };
        Returns: number;
      };
      get_lesson_playback: {
        Args: { p_lesson_id: string };
        Returns: { video_provider: VideoProvider; video_id: string }[];
      };
      /**
       * Criar um livro é mais de um INSERT (o livro e as duas localizações);
       * reordenar é uma troca entre duas linhas com order_index único. As duas
       * coisas precisam de uma transação, e por isso viraram função.
       *
       * `move_book` devolve `false` quando o livro já é o primeiro ou o
       * último — não é erro, é "não há para onde mover".
       * Ver 20260806061500_book_catalog_operations_and_covers.sql.
       */
      create_book: {
        Args: { p_slug: string; p_title: string };
        Returns: string;
      };
      move_book: {
        Args: { p_book_id: string; p_direction: "up" | "down" };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
