DO $$
DECLARE
  r RECORD;
  cores text[] := ARRAY['Branca','Preta','Parda','Indígena','Amarela'];
  escolas text[] := ARRAY['Fundamental incompleto','Fundamental completo','Médio incompleto','Médio completo','Superior incompleto','Superior completo','Pós-graduação'];
  setores text[] := ARRAY['Comércio','Indústria','Serviços','Construção civil','Transporte','Agropecuária','Tecnologia','Saúde','Educação','Segurança privada','Alimentação','Autônomo'];
  empresas text[] := ARRAY['Posto São Jorge','Mercado Bom Preço','Construtora Delta','Oficina do Zé','Transportadora Rápida','Frigorífico Central','Supermercado Extra','Padaria Pão Quente','Auto Peças Silva','Fazenda Boa Vista','Bar do João','Metalúrgica Progresso','Loja de Material ABC','Restaurante Sabor Caseiro','Distribuidora Norte','Serralheria Aço Forte','Empresa de Ônibus União','Clínica Popular','Farmácia do Povo','Açougue Central'];
  nomes_mae text[] := ARRAY['Maria','Ana','Francisca','Antônia','Adriana','Juliana','Marcia','Fernanda','Patricia','Aline','Sandra','Camila','Luciana','Aparecida','Josefa','Rosangela','Terezinha','Edilene','Simone','Eliane','Cláudia','Vera','Joana','Luzia','Sônia','Ivone','Madalena','Conceição','Raimunda','Fátima'];
  nomes_pai text[] := ARRAY['José','João','Antonio','Francisco','Carlos','Paulo','Pedro','Lucas','Marcos','Luis','Manoel','Sebastião','Raimundo','Benedito','Roberto','Jorge','Geraldo','Valdir','Ademir','Oswaldo','Nelson','Edson','Cícero','Joaquim','Reginaldo','Severino','Cláudio','Márcio','Fernando','Ronaldo'];
  ddds text[] := ARRAY['11','21','31','41','51','61','71','81','85','91','27','48','62','65','67','68','69','79','82','83','84','86','87','88','92','93','94','95','96','97','98','99'];
  v_ddd text;
  v_tel text;
  v_nasc date;
  v_digits text;
BEGIN
  FOR r IN SELECT id FROM agressores LOOP
    -- cor_raca
    UPDATE agressores SET cor_raca = cores[1 + floor(random()*array_length(cores,1))]
    WHERE id = r.id AND cor_raca IS NULL;

    -- company_public
    UPDATE agressores SET company_public = empresas[1 + floor(random()*array_length(empresas,1))]
    WHERE id = r.id AND company_public IS NULL;

    -- sector
    UPDATE agressores SET sector = setores[1 + floor(random()*array_length(setores,1))]
    WHERE id = r.id AND sector IS NULL;

    -- data_nascimento (entre 1960 e 2000)
    v_nasc := ('1960-01-01'::date + (random() * 14600)::int);
    UPDATE agressores SET data_nascimento = v_nasc
    WHERE id = r.id AND data_nascimento IS NULL;

    -- telefone
    v_ddd := ddds[1 + floor(random()*array_length(ddds,1))];
    v_digits := lpad(floor(random()*100000000)::text, 8, '0');
    v_tel := v_ddd || '9' || v_digits;
    UPDATE agressores SET telefone = v_tel
    WHERE id = r.id AND telefone IS NULL;

    -- nome_mae_parcial
    UPDATE agressores SET nome_mae_parcial = nomes_mae[1 + floor(random()*array_length(nomes_mae,1))]
    WHERE id = r.id AND nome_mae_parcial IS NULL;

    -- nome_pai_parcial (já preenchido na maioria, mas garantir)
    UPDATE agressores SET nome_pai_parcial = nomes_pai[1 + floor(random()*array_length(nomes_pai,1))]
    WHERE id = r.id AND nome_pai_parcial IS NULL;

    -- appearance_notes
    UPDATE agressores SET appearance_notes = (ARRAY[
      'Cicatriz no rosto lado esquerdo',
      'Tatuagem no braço direito',
      'Usa óculos',
      'Barba cheia',
      'Careca',
      'Cabelo cacheado',
      'Alto, magro',
      'Baixo, forte',
      'Tatuagem no pescoço',
      'Bigode fino',
      'Sobrancelha grossa',
      'Orelha furada',
      'Manco da perna direita',
      'Dente de ouro',
      'Cicatriz na mão'
    ])[1 + floor(random()*15)]
    WHERE id = r.id AND appearance_notes IS NULL;

  END LOOP;
END;
$$;