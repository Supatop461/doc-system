--
-- PostgreSQL database dump
--

-- Dumped from database version 13.21
-- Dumped by pg_dump version 17.5

-- Started on 2026-02-13 13:12:13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 6 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- TOC entry 3 (class 3079 OID 43097)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 3154 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- TOC entry 2 (class 3079 OID 34892)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 3155 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 684 (class 1247 OID 34709)
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'ADMIN',
    'USER'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- TOC entry 215 (class 1255 OID 34730)
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 211 (class 1259 OID 34825)
-- Name: document_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_types (
    document_type_id bigint NOT NULL,
    name character varying(150) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by bigint NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


ALTER TABLE public.document_types OWNER TO postgres;

--
-- TOC entry 210 (class 1259 OID 34823)
-- Name: document_types_document_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_types_document_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_types_document_type_id_seq OWNER TO postgres;

--
-- TOC entry 3156 (class 0 OID 0)
-- Dependencies: 210
-- Name: document_types_document_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_types_document_type_id_seq OWNED BY public.document_types.document_type_id;


--
-- TOC entry 207 (class 1259 OID 34765)
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    document_id bigint NOT NULL,
    original_file_name character varying(255) NOT NULL,
    stored_file_name character varying(255) NOT NULL,
    file_path text NOT NULL,
    file_size bigint,
    mime_type character varying(120),
    folder_id bigint,
    created_by bigint NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    deleted_by bigint,
    document_type_id bigint,
    it_job_type_id bigint,
    title character varying(255),
    public_url text
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- TOC entry 206 (class 1259 OID 34763)
-- Name: documents_document_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.documents_document_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.documents_document_id_seq OWNER TO postgres;

--
-- TOC entry 3157 (class 0 OID 0)
-- Dependencies: 206
-- Name: documents_document_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.documents_document_id_seq OWNED BY public.documents.document_id;


--
-- TOC entry 205 (class 1259 OID 34734)
-- Name: folders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.folders (
    folder_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    parent_id bigint,
    created_by bigint NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    deleted_by bigint,
    document_type_id bigint,
    it_job_type_id bigint,
    doc_prefix character varying(20),
    description text
);


ALTER TABLE public.folders OWNER TO postgres;

--
-- TOC entry 204 (class 1259 OID 34732)
-- Name: folders_folder_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.folders_folder_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.folders_folder_id_seq OWNER TO postgres;

--
-- TOC entry 3158 (class 0 OID 0)
-- Dependencies: 204
-- Name: folders_folder_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.folders_folder_id_seq OWNED BY public.folders.folder_id;


--
-- TOC entry 209 (class 1259 OID 34800)
-- Name: it_job_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.it_job_types (
    it_job_type_id bigint NOT NULL,
    name character varying(150) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by bigint NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


ALTER TABLE public.it_job_types OWNER TO postgres;

--
-- TOC entry 208 (class 1259 OID 34798)
-- Name: it_job_types_it_job_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.it_job_types_it_job_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.it_job_types_it_job_type_id_seq OWNER TO postgres;

--
-- TOC entry 3159 (class 0 OID 0)
-- Dependencies: 208
-- Name: it_job_types_it_job_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.it_job_types_it_job_type_id_seq OWNED BY public.it_job_types.it_job_type_id;


--
-- TOC entry 203 (class 1259 OID 34715)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    user_id bigint NOT NULL,
    username character varying(100) NOT NULL,
    password_hash text NOT NULL,
    role public.user_role DEFAULT 'USER'::public.user_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 202 (class 1259 OID 34713)
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_user_id_seq OWNER TO postgres;

--
-- TOC entry 3160 (class 0 OID 0)
-- Dependencies: 202
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- TOC entry 213 (class 1259 OID 34862)
-- Name: v_folder_document_counts; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_folder_document_counts AS
 SELECT f.folder_id,
    f.name,
    f.parent_id,
    count(d.document_id) AS document_count
   FROM (public.folders f
     LEFT JOIN public.documents d ON (((d.folder_id = f.folder_id) AND (d.deleted_at IS NULL))))
  WHERE (f.deleted_at IS NULL)
  GROUP BY f.folder_id, f.name, f.parent_id;


ALTER VIEW public.v_folder_document_counts OWNER TO postgres;

--
-- TOC entry 212 (class 1259 OID 34858)
-- Name: v_folder_tree; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_folder_tree AS
 SELECT f1.folder_id AS level1_id,
    f1.name AS level1_name,
    f2.folder_id AS level2_id,
    f2.name AS level2_name,
    f3.folder_id AS level3_id,
    f3.name AS level3_name
   FROM ((public.folders f1
     LEFT JOIN public.folders f2 ON (((f2.parent_id = f1.folder_id) AND (f2.deleted_at IS NULL))))
     LEFT JOIN public.folders f3 ON (((f3.parent_id = f2.folder_id) AND (f3.deleted_at IS NULL))))
  WHERE ((f1.parent_id IS NULL) AND (f1.deleted_at IS NULL));


ALTER VIEW public.v_folder_tree OWNER TO postgres;

--
-- TOC entry 214 (class 1259 OID 34867)
-- Name: v_folders_trash; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_folders_trash AS
 SELECT f.folder_id,
    f.name,
    f.parent_id,
    pf.name AS parent_name,
    f.deleted_at,
    f.deleted_by,
    u.username AS deleted_by_username
   FROM ((public.folders f
     LEFT JOIN public.folders pf ON ((pf.folder_id = f.parent_id)))
     LEFT JOIN public.users u ON ((u.user_id = f.deleted_by)))
  WHERE (f.deleted_at IS NOT NULL);


ALTER VIEW public.v_folders_trash OWNER TO postgres;

--
-- TOC entry 2956 (class 2604 OID 34828)
-- Name: document_types document_type_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_types ALTER COLUMN document_type_id SET DEFAULT nextval('public.document_types_document_type_id_seq'::regclass);


--
-- TOC entry 2949 (class 2604 OID 34768)
-- Name: documents document_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents ALTER COLUMN document_id SET DEFAULT nextval('public.documents_document_id_seq'::regclass);


--
-- TOC entry 2946 (class 2604 OID 34737)
-- Name: folders folder_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.folders ALTER COLUMN folder_id SET DEFAULT nextval('public.folders_folder_id_seq'::regclass);


--
-- TOC entry 2952 (class 2604 OID 34803)
-- Name: it_job_types it_job_type_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.it_job_types ALTER COLUMN it_job_type_id SET DEFAULT nextval('public.it_job_types_it_job_type_id_seq'::regclass);


--
-- TOC entry 2941 (class 2604 OID 34718)
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- TOC entry 3147 (class 0 OID 34825)
-- Dependencies: 211
-- Data for Name: document_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.document_types (document_type_id, name, is_active, created_by, created_at, updated_at, deleted_at) FROM stdin;
3	รายงานการประชุม	t	1	2026-02-12 09:20:53.292137	2026-02-12 09:20:53.292137	\N
4	เอกสารสัญญา	t	1	2026-02-12 09:20:58.596252	2026-02-12 09:20:58.596252	\N
5	เอกสารห้อง Server	t	1	2026-02-12 09:21:05.041238	2026-02-12 09:21:05.041238	\N
6	เอกสารจัดซื้อจัดจ้าง	t	1	2026-02-12 09:21:12.052113	2026-02-12 09:21:12.052113	\N
7	หนังสือเวียน	t	1	2026-02-12 09:21:16.975687	2026-02-12 09:21:16.975687	\N
2	เอกสารขอใช้งาน	t	1	2026-02-12 09:20:47.242451	2026-02-12 14:15:52.143234	\N
8	นโยบายและข้อปฏิบัติ	t	1	2026-02-12 09:21:22.215516	2026-02-12 14:16:13.763721	\N
\.


--
-- TOC entry 3143 (class 0 OID 34765)
-- Dependencies: 207
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.documents (document_id, original_file_name, stored_file_name, file_path, file_size, mime_type, folder_id, created_by, created_at, updated_at, deleted_at, deleted_by, document_type_id, it_job_type_id, title, public_url) FROM stdin;
1	1770801430950-119209192-185469.jpg	1770801430950-119209192-185469.jpg	C:\\xampp\\htdocs\\top\\1770801430950-119209192-185469.jpg	52762	image/jpeg	\N	1	2026-02-12 09:22:31.956868	2026-02-12 09:22:31.956868	\N	\N	\N	\N	1770801430950-119209192-185469	/top/1770801430950-119209192-185469.jpg
2	1770692494859-162788142-___________.png	1770692494859-162788142-___________.png	C:\\xampp\\htdocs\\top\\1770692494859-162788142-___________.png	235435	image/png	\N	1	2026-02-12 09:22:31.962673	2026-02-12 09:22:31.962673	\N	\N	\N	\N	1770692494859-162788142-___________	/top/1770692494859-162788142-___________.png
3	สกรีนช็อต 2026-02-05 110318.png	1770879920988-839606260-__________2026-02-05_110318.png	D:\\doc-system\\backend\\uploads\\1770879920988-839606260-__________2026-02-05_110318.png	154237	image/png	2	1	2026-02-12 14:05:21.156741	2026-02-12 14:05:21.156741	\N	\N	2	2	12121212	/top/1770879920988-839606260-__________2026-02-05_110318.png
4	สกรีนช็อต 2026-02-05 111051.png	1770879921197-492737349-__________2026-02-05_111051.png	D:\\doc-system\\backend\\uploads\\1770879921197-492737349-__________2026-02-05_111051.png	158622	image/png	2	1	2026-02-12 14:05:21.216953	2026-02-12 14:05:21.216953	\N	\N	2	2	สกรีนช็อต 2026-02-05 111051	/top/1770879921197-492737349-__________2026-02-05_111051.png
5	สกรีนช็อต 2026-02-05 113254.png	1770879921288-837341368-__________2026-02-05_113254.png	D:\\doc-system\\backend\\uploads\\1770879921288-837341368-__________2026-02-05_113254.png	184099	image/png	2	1	2026-02-12 14:05:21.305033	2026-02-12 14:05:21.305033	\N	\N	2	2	สกรีนช็อต 2026-02-05 113254	/top/1770879921288-837341368-__________2026-02-05_113254.png
6	สกรีนช็อต 2026-02-05 135354.png	1770879921369-336940288-__________2026-02-05_135354.png	D:\\doc-system\\backend\\uploads\\1770879921369-336940288-__________2026-02-05_135354.png	238584	image/png	2	1	2026-02-12 14:05:21.387715	2026-02-12 14:05:21.387715	\N	\N	2	2	สกรีนช็อต 2026-02-05 135354	/top/1770879921369-336940288-__________2026-02-05_135354.png
13	สกรีนช็อต 2026-02-05 152906.png	1770879921998-263683853-__________2026-02-05_152906.png	D:\\doc-system\\backend\\uploads\\1770879921998-263683853-__________2026-02-05_152906.png	130419	image/png	2	1	2026-02-12 14:05:22.009204	2026-02-13 08:50:56.366331	2026-02-13 08:50:56.366331	4	2	2	สกรีนช็อต 2026-02-05 152906	/top/1770879921998-263683853-__________2026-02-05_152906.png
12	สกรีนช็อต 2026-02-05 152727.png	1770879921929-239911679-__________2026-02-05_152727.png	D:\\doc-system\\backend\\uploads\\1770879921929-239911679-__________2026-02-05_152727.png	160854	image/png	2	1	2026-02-12 14:05:21.943597	2026-02-13 08:50:59.182466	2026-02-13 08:50:59.182466	4	2	2	15151515	/top/1770879921929-239911679-__________2026-02-05_152727.png
11	สกรีนช็อต 2026-02-05 145521.png	1770879921829-17071713-__________2026-02-05_145521.png	D:\\doc-system\\backend\\uploads\\1770879921829-17071713-__________2026-02-05_145521.png	159126	image/png	2	1	2026-02-12 14:05:21.84703	2026-02-13 08:51:02.233596	2026-02-13 08:51:02.233596	4	2	2	สกรีนช็อต 2026-02-05 145521	/top/1770879921829-17071713-__________2026-02-05_145521.png
10	สกรีนช็อต 2026-02-05 145503.png	1770879921731-194250176-__________2026-02-05_145503.png	D:\\doc-system\\backend\\uploads\\1770879921731-194250176-__________2026-02-05_145503.png	226486	image/png	2	1	2026-02-12 14:05:21.76177	2026-02-13 08:51:04.684084	2026-02-13 08:51:04.684084	4	2	2	สกรีนช็อต 2026-02-05 145503	/top/1770879921731-194250176-__________2026-02-05_145503.png
9	สกรีนช็อต 2026-02-05 142634.png	1770879921648-861548971-__________2026-02-05_142634.png	D:\\doc-system\\backend\\uploads\\1770879921648-861548971-__________2026-02-05_142634.png	286273	image/png	2	1	2026-02-12 14:05:21.669214	2026-02-13 08:51:22.402311	2026-02-13 08:51:22.402311	4	2	2	สกรีนช็อต 2026-02-05 142634	/top/1770879921648-861548971-__________2026-02-05_142634.png
8	สกรีนช็อต 2026-02-05 135502.png	1770879921563-495599636-__________2026-02-05_135502.png	D:\\doc-system\\backend\\uploads\\1770879921563-495599636-__________2026-02-05_135502.png	366180	image/png	2	1	2026-02-12 14:05:21.586147	2026-02-13 08:51:26.242128	2026-02-13 08:51:26.242128	4	2	2	สกรีนช็อต 2026-02-05 135502	/top/1770879921563-495599636-__________2026-02-05_135502.png
7	สกรีนช็อต 2026-02-05 135451.png	1770879921471-227708784-__________2026-02-05_135451.png	D:\\doc-system\\backend\\uploads\\1770879921471-227708784-__________2026-02-05_135451.png	291286	image/png	2	1	2026-02-12 14:05:21.490914	2026-02-13 08:51:30.778118	2026-02-13 08:51:30.778118	4	2	2	สกรีนช็อต 2026-02-05 135451	/top/1770879921471-227708784-__________2026-02-05_135451.png
14	สกรีนช็อต 2026-02-05 110318.png	1770947584978-359828433-__________2026-02-05_110318.png	D:\\doc-system\\backend\\uploads\\1770947584978-359828433-__________2026-02-05_110318.png	154237	image/png	3	4	2026-02-13 08:53:05.12822	2026-02-13 10:11:24.720858	2026-02-13 10:11:24.720858	1	2	2	ท็อปสวัสดีครับ	/top/1770947584978-359828433-__________2026-02-05_110318.png
\.


--
-- TOC entry 3141 (class 0 OID 34734)
-- Dependencies: 205
-- Data for Name: folders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.folders (folder_id, name, parent_id, created_by, created_at, updated_at, deleted_at, deleted_by, document_type_id, it_job_type_id, doc_prefix, description) FROM stdin;
1	แฟ้มเอกสารขอuser	\N	1	2026-02-12 09:41:50.339176	2026-02-12 09:41:50.339176	\N	\N	2	2	User	เอกสารขอUser
2	เอกสารขอuser ปี2568	1	1	2026-02-12 09:42:56.540471	2026-02-12 09:42:56.540471	\N	\N	2	2	User68_	เอกสารขอUser ปี2568ทั้งหมด
3	เอกสารขอuser ปี2569	1	1	2026-02-12 09:44:34.458277	2026-02-13 10:20:19.720702	2026-02-13 10:20:19.720702	1	2	2	User69_	เอกสารขอUser ปี2569ทั้งหมด
\.


--
-- TOC entry 3145 (class 0 OID 34800)
-- Dependencies: 209
-- Data for Name: it_job_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.it_job_types (it_job_type_id, name, is_active, created_by, created_at, updated_at, deleted_at) FROM stdin;
1	ผู้ใช้และสิทธิ์การใช้งาน	t	1	2026-02-12 09:21:39.418417	2026-02-12 09:21:39.418417	\N
2	ระบบงานและแอปพลิเคชัน	t	1	2026-02-12 09:21:45.292385	2026-02-12 09:21:45.292385	\N
3	เครือข่ายและอินเทอร์เน็ต	t	1	2026-02-12 09:21:51.977063	2026-02-12 09:21:51.977063	\N
4	เครื่องแม่ข่ายและห้อง Server	t	1	2026-02-12 09:21:59.378052	2026-02-12 09:21:59.378052	\N
5	ความปลอดภัยสารสนเทศ	t	1	2026-02-12 09:22:04.340716	2026-02-12 09:22:04.340716	\N
6	อุปกรณ์คอมพิวเตอร์และฮาร์ดแวร์	t	1	2026-02-12 09:22:09.524751	2026-02-12 09:22:09.524751	\N
7	จัดซื้อจัดจ้างและสัญญา	t	1	2026-02-12 09:22:15.260343	2026-02-12 09:22:15.260343	\N
8	ระเบียบ/นโยบาย/มาตรฐาน	t	1	2026-02-12 09:22:20.155968	2026-02-12 09:22:20.155968	\N
9	อื่นๆ	t	1	2026-02-12 09:22:27.10347	2026-02-12 09:22:27.10347	\N
\.


--
-- TOC entry 3139 (class 0 OID 34715)
-- Dependencies: 203
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (user_id, username, password_hash, role, is_active, created_at, updated_at) FROM stdin;
1	admin	$2b$10$P2QOSdmxvgAlDQJWSEeUDefwfdEfers2Ltg.OxCyNCbzGcwXX795m	ADMIN	t	2026-01-22 10:45:18.091129	2026-01-26 09:26:43.605891
4	6710210461	$2b$10$kwzeR/2MLZFSv98R2hPuuuC0aK3M9.rIJZzJSy4WXJD.LYu6NzodW	USER	t	2026-02-07 16:42:37.924145	2026-02-07 16:42:37.924145
\.


--
-- TOC entry 3161 (class 0 OID 0)
-- Dependencies: 210
-- Name: document_types_document_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.document_types_document_type_id_seq', 8, true);


--
-- TOC entry 3162 (class 0 OID 0)
-- Dependencies: 206
-- Name: documents_document_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.documents_document_id_seq', 14, true);


--
-- TOC entry 3163 (class 0 OID 0)
-- Dependencies: 204
-- Name: folders_folder_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.folders_folder_id_seq', 3, true);


--
-- TOC entry 3164 (class 0 OID 0)
-- Dependencies: 208
-- Name: it_job_types_it_job_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.it_job_types_it_job_type_id_seq', 9, true);


--
-- TOC entry 3165 (class 0 OID 0)
-- Dependencies: 202
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_user_id_seq', 6, true);


--
-- TOC entry 2985 (class 2606 OID 34835)
-- Name: document_types document_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_name_key UNIQUE (name);


--
-- TOC entry 2987 (class 2606 OID 34833)
-- Name: document_types document_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_pkey PRIMARY KEY (document_type_id);


--
-- TOC entry 2970 (class 2606 OID 34775)
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (document_id);


--
-- TOC entry 2972 (class 2606 OID 34777)
-- Name: documents documents_stored_file_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_stored_file_name_key UNIQUE (stored_file_name);


--
-- TOC entry 2965 (class 2606 OID 34741)
-- Name: folders folders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_pkey PRIMARY KEY (folder_id);


--
-- TOC entry 2981 (class 2606 OID 34810)
-- Name: it_job_types it_job_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.it_job_types
    ADD CONSTRAINT it_job_types_name_key UNIQUE (name);


--
-- TOC entry 2983 (class 2606 OID 34808)
-- Name: it_job_types it_job_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.it_job_types
    ADD CONSTRAINT it_job_types_pkey PRIMARY KEY (it_job_type_id);


--
-- TOC entry 2961 (class 2606 OID 34727)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- TOC entry 2963 (class 2606 OID 34729)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 2973 (class 1259 OID 34796)
-- Name: idx_documents_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_created_at ON public.documents USING btree (created_at);


--
-- TOC entry 2974 (class 1259 OID 34794)
-- Name: idx_documents_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_created_by ON public.documents USING btree (created_by);


--
-- TOC entry 2975 (class 1259 OID 34881)
-- Name: idx_documents_deleted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_deleted ON public.documents USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);


--
-- TOC entry 2976 (class 1259 OID 34795)
-- Name: idx_documents_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_deleted_at ON public.documents USING btree (deleted_at);


--
-- TOC entry 2977 (class 1259 OID 34879)
-- Name: idx_documents_folder; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_folder ON public.documents USING btree (folder_id) WHERE (deleted_at IS NULL);


--
-- TOC entry 2978 (class 1259 OID 34793)
-- Name: idx_documents_folder_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_folder_id ON public.documents USING btree (folder_id);


--
-- TOC entry 2966 (class 1259 OID 34758)
-- Name: idx_folders_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_folders_created_by ON public.folders USING btree (created_by);


--
-- TOC entry 2967 (class 1259 OID 34759)
-- Name: idx_folders_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_folders_deleted_at ON public.folders USING btree (deleted_at);


--
-- TOC entry 2968 (class 1259 OID 34757)
-- Name: idx_folders_parent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_folders_parent_id ON public.folders USING btree (parent_id);


--
-- TOC entry 2979 (class 1259 OID 34821)
-- Name: idx_it_job_types_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_it_job_types_active ON public.it_job_types USING btree (is_active);


--
-- TOC entry 3004 (class 2620 OID 34846)
-- Name: document_types trg_document_types_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_document_types_updated_at BEFORE UPDATE ON public.document_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 3002 (class 2620 OID 34797)
-- Name: documents trg_documents_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 3001 (class 2620 OID 34760)
-- Name: folders trg_folders_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_folders_updated_at BEFORE UPDATE ON public.folders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 3003 (class 2620 OID 34847)
-- Name: it_job_types trg_it_job_types_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_it_job_types_updated_at BEFORE UPDATE ON public.it_job_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 3000 (class 2620 OID 34731)
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 2999 (class 2606 OID 34836)
-- Name: document_types document_types_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id) ON DELETE RESTRICT;


--
-- TOC entry 2993 (class 2606 OID 34783)
-- Name: documents documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id) ON DELETE RESTRICT;


--
-- TOC entry 2994 (class 2606 OID 34788)
-- Name: documents documents_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(user_id) ON DELETE RESTRICT;


--
-- TOC entry 2995 (class 2606 OID 34848)
-- Name: documents documents_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES public.document_types(document_type_id) ON DELETE SET NULL;


--
-- TOC entry 2996 (class 2606 OID 34778)
-- Name: documents documents_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(folder_id) ON DELETE SET NULL;


--
-- TOC entry 2997 (class 2606 OID 34853)
-- Name: documents documents_it_job_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_it_job_type_id_fkey FOREIGN KEY (it_job_type_id) REFERENCES public.it_job_types(it_job_type_id) ON DELETE SET NULL;


--
-- TOC entry 2988 (class 2606 OID 34747)
-- Name: folders folders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id) ON DELETE RESTRICT;


--
-- TOC entry 2989 (class 2606 OID 34752)
-- Name: folders folders_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(user_id) ON DELETE RESTRICT;


--
-- TOC entry 2990 (class 2606 OID 34925)
-- Name: folders folders_document_type_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_document_type_fk FOREIGN KEY (document_type_id) REFERENCES public.document_types(document_type_id) ON DELETE SET NULL;


--
-- TOC entry 2991 (class 2606 OID 34930)
-- Name: folders folders_it_job_type_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_it_job_type_fk FOREIGN KEY (it_job_type_id) REFERENCES public.it_job_types(it_job_type_id) ON DELETE SET NULL;


--
-- TOC entry 2992 (class 2606 OID 34742)
-- Name: folders folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.folders(folder_id) ON DELETE RESTRICT;


--
-- TOC entry 2998 (class 2606 OID 34811)
-- Name: it_job_types it_job_types_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.it_job_types
    ADD CONSTRAINT it_job_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id) ON DELETE RESTRICT;


--
-- TOC entry 3153 (class 0 OID 0)
-- Dependencies: 6
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


-- Completed on 2026-02-13 13:12:14

--
-- PostgreSQL database dump complete
--

