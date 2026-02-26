
DO $$
DECLARE
  u RECORD;
  agg_id uuid;
  nomes text[] := ARRAY['Carlos','Roberto','Marcelo','Fernando','André','Paulo','Ricardo','Luciano','Fábio','Diego','Rafael','Bruno','Leandro','Eduardo','Alexandre','Gustavo','Thiago','Marcos','Rogério','Sérgio'];
  sobrenomes text[] := ARRAY['Silva','Santos','Oliveira','Souza','Pereira','Costa','Ferreira','Almeida','Nascimento','Lima','Araújo','Ribeiro','Carvalho','Gomes','Martins','Rocha','Barros','Melo','Correia','Teixeira'];
  profissoes text[] := ARRAY['Pedreiro','Motorista','Vendedor','Segurança','Mecânico','Eletricista','Garçom','Autônomo','Comerciante','Operador de máquinas','Pintor','Caminhoneiro','Motoboy','Frentista','Açougueiro'];
  cidades text[] := ARRAY['São Paulo - SP','Rio de Janeiro - RJ','Belo Horizonte - MG','Salvador - BA','Recife - PE','Fortaleza - CE','Curitiba - PR','Manaus - AM','Belém - PA','Goiânia - GO'];
  bairros text[] := ARRAY['Centro','Jardim das Flores','Vila Nova','Parque Industrial','Cohab','Conjunto Habitacional','Vila Mariana','Bela Vista','Santa Cruz','São Jorge'];
  escolaridades text[] := ARRAY['Fundamental incompleto','Fundamental completo','Médio incompleto','Médio completo','Superior incompleto'];
  idx int := 0;
  nome_chosen text;
  sobrenome_chosen text;
  age_min int;
  age_max int;
  risk int;
  rlevel text;
  vt text[];
  xi text[];
  pt text[];
BEGIN
  FOR u IN
    SELECT id FROM public.usuarios
    WHERE id NOT IN (SELECT DISTINCT reporter_user_id FROM public.aggressor_incidents)
  LOOP
    idx := idx + 1;
    nome_chosen := nomes[1 + (floor(random() * 20))::int];
    sobrenome_chosen := sobrenomes[1 + (floor(random() * 20))::int];
    age_min := 25 + (floor(random() * 20))::int;
    age_max := age_min + 2 + (floor(random() * 5))::int;
    risk := 20 + (floor(random() * 70))::int;
    
    IF risk >= 70 THEN rlevel := 'alto';
    ELSIF risk >= 40 THEN rlevel := 'medio';
    ELSE rlevel := 'baixo';
    END IF;

    -- pick violence types
    CASE (floor(random()*6))::int
      WHEN 0 THEN vt := ARRAY['psicológica','verbal'];
      WHEN 1 THEN vt := ARRAY['física','psicológica'];
      WHEN 2 THEN vt := ARRAY['verbal','patrimonial'];
      WHEN 3 THEN vt := ARRAY['psicológica','moral'];
      WHEN 4 THEN vt := ARRAY['física','verbal','psicológica'];
      ELSE vt := ARRAY['verbal'];
    END CASE;

    -- pick insults
    CASE (floor(random()*5))::int
      WHEN 0 THEN xi := ARRAY['burra','vagabunda','inútil'];
      WHEN 1 THEN xi := ARRAY['piranha','louca','ridícula'];
      WHEN 2 THEN xi := ARRAY['gorda','feia','preguiçosa'];
      WHEN 3 THEN xi := ARRAY['vadia','maluca'];
      ELSE xi := ARRAY['idiota','incompetente'];
    END CASE;

    -- pick pattern tags
    CASE (floor(random()*4))::int
      WHEN 0 THEN pt := ARRAY['ciúme excessivo','controle financeiro'];
      WHEN 1 THEN pt := ARRAY['isolamento social','ameaças verbais'];
      WHEN 2 THEN pt := ARRAY['humilhação pública','ciúme excessivo','controle financeiro'];
      ELSE pt := ARRAY['ameaças verbais','isolamento social'];
    END CASE;

    INSERT INTO public.agressores (
      nome, name_normalized, display_name_masked,
      approx_age_min, approx_age_max,
      nome_pai_parcial, father_first_name, father_name_partial_normalized,
      nome_mae_parcial, mother_first_name, mother_name_partial_normalized,
      primary_city_uf, neighborhoods, profession, escolaridade,
      phone_clues, email_clues, vehicles,
      tem_arma_em_casa, forca_seguranca,
      risk_score, risk_level,
      xingamentos_frequentes,
      quality_score,
      search_tokens
    ) VALUES (
      nome_chosen || ' ' || sobrenome_chosen,
      lower(nome_chosen || ' ' || sobrenome_chosen),
      left(nome_chosen, 3) || '*** ' || left(sobrenome_chosen, 1) || '***',
      age_min, age_max,
      left(sobrenomes[1 + (floor(random() * 20))::int], 4),
      nomes[1 + (floor(random() * 20))::int],
      lower(nomes[1 + (floor(random() * 20))::int]),
      left(sobrenomes[1 + (floor(random() * 20))::int], 4),
      nomes[1 + (floor(random() * 20))::int],
      lower(nomes[1 + (floor(random() * 20))::int]),
      cidades[1 + (floor(random() * 10))::int],
      ARRAY[bairros[1 + (floor(random() * 10))::int]],
      profissoes[1 + (floor(random() * 15))::int],
      escolaridades[1 + (floor(random() * 5))::int],
      jsonb_build_array(jsonb_build_object('ddd', (11 + (floor(random()*80))::int)::text, 'suffix', lpad((floor(random()*10000))::int::text, 4, '0'))),
      '[]'::jsonb,
      CASE WHEN random() > 0.7 THEN jsonb_build_array(jsonb_build_object('plate_partial', upper(chr(65+(floor(random()*26))::int) || chr(65+(floor(random()*26))::int) || chr(65+(floor(random()*26))::int)), 'color', (ARRAY['Prata','Preto','Branco','Vermelho','Cinza'])[1+(floor(random()*5))::int])) ELSE '[]'::jsonb END,
      random() > 0.85,
      random() > 0.92,
      risk, rlevel,
      xi,
      40 + (floor(random() * 50))::int,
      ARRAY[lower(nome_chosen), lower(sobrenome_chosen)]
    )
    RETURNING id INTO agg_id;

    INSERT INTO public.aggressor_incidents (
      aggressor_id, reporter_user_id,
      severity, confidence,
      violence_types, pattern_tags,
      description_sanitized,
      source_type, occurred_at_month
    ) VALUES (
      agg_id, u.id,
      2 + (floor(random() * 4))::int,
      0.5 + random() * 0.4,
      vt, pt,
      'Relato registrado automaticamente via seed de dados de teste.',
      'usuaria',
      to_char(now() - (floor(random()*180) || ' days')::interval, 'YYYY-MM')
    );
  END LOOP;

  RAISE NOTICE 'Agressores criados: %', idx;
END $$;
