#!/bin/bash

mongo rodovias --eval 'db.adminCommand("listDatabases").databases.forEach( function (d) {     if (d.name != "local" && d.name != "admin"  && d.name != "apiomat"  && d.name != "config")         db.getSiblingDB(d.name).dropDatabase();  })'

mkdir -p utf8

for file in *.csv
do
  iconv -f iso-8859-1 -t utf-8 $file > "utf8/$file"
  sed -i '' 's/;/,/g' "utf8/$file"
  sed -i '' 's/(null)//g' "utf8/$file"

  mongoimport --db rodovias --collection $(echo `expr "$file" : '^\(.[A-Za-z]*\)'`) --ignoreBlanks --headerline --type csv --file "utf8/$file"
done

echo "Creating Indexes"
mongo rodovias --eval 'db.localbr.ensureIndex({"lbrid": 1})'
mongo rodovias --eval 'db.ocorrenciaPessoa.ensureIndex({"opeocoid": 1})'
mongo rodovias --eval 'db.tabelaPessoa.ensureIndex({"pesid": 1})'
mongo rodovias --eval 'db.ocorrenciaacidente.ensureIndex({"oacocoid": 1})'

echo "Embeding documents"
mongo rodovias --eval 'db.ocorrenciaacidente.find().forEach( function(doc) { 
  db.ocorrenciaacidente.update(doc, {$set : { tipoAcidente: db.tipoAcidente.findOne( {ttacodigo: doc.oacttacodigo}, {'_id': false, 'ttadescricao': true}).ttadescricao } }) 
});'

mongo rodovias --eval 'db.ocorrenciaacidente.find({oactcacodigo : {$gt: 14}}).forEach( function(doc) { 
  db.ocorrenciaacidente.update(doc, {$set : { causaAcidente : db.causaacidente.findOne( {tcacodigo: doc.oactcacodigo}, {'_id': false, 'tcadescricao': true}).tcadescricao } }) 
});'

mongo rodovias --eval 'db.ocorrenciaacidente.find({oactcacodigo : {$gt: 0, $lt: 9}}).forEach( function(doc) { 
  db.ocorrenciaacidente.update(doc, {$set : { causaAcidente : db.causaacidente.findOne( {tcacodigo: doc.oactcacodigo}, {'_id': false, 'tcadescricao': true}).tcadescricao } }) 
});'

mongo rodovias --eval 'db.tabelaPessoa.find( {pesestadofisico: {$gt: 0, $lt: 6} }).sort({'_id': 1}).forEach( function(doc) {
  db.tabelaPessoa.update(doc, {$set : { pesestadofisico: db.estadofisico.findOne( {esid: doc.pesestadofisico}, {'_id': false, 'estadofisico': true}).estadofisico } })
});'

mongo rodovias --eval 'db.ocorrenciaPessoa.find().forEach( function(doc) {
  db.ocorrenciaPessoa.update(doc, {$set : { dados: db.tabelaPessoa.findOne( {pesid: doc.opepesid}, {'_id': false, 'pesalcool':true,'pescapacete':true,'pescinto': true, 'pesdormindo': true, 'pesestadofisico': true, 'peshabilitado': true, 'pesidade': true, 'pessexo': true, 'pessinal': true, 'pesufcnh': true }) } })
});'

mongo rodovias --eval 'db.ocorrencia.find().forEach( function(doc) {
    db.ocorrencia.update(doc, {$set : { local: db.localbr.findOne( {lbrid: doc.ocolocal}, {'_id': false, 'lbruf': true, 'lbrbr': true, 'lbrkm': true, 'lbrpnvid': true })} })
});'

mongo rodovias --eval 'db.ocorrencia.find().forEach( function(doc) {
  db.ocorrencia.update(doc, {$pushAll : { pessoas: db.ocorrenciaPessoa.find( {opeocoid: doc.ocoid}).toArray() } })
});'

mongo rodovias --eval 'db.ocorrencia.find().forEach( function(doc) { 
  db.ocorrencia.update(doc, {$set : { causaAcidente : db.ocorrenciaacidente.find( {oacocoid: doc.ocoid}, {'_id': false, 'tipoAcidente': true, 'causaAcidente': true}) } }) 
});'

mongo rodovias --eval 'db.ocorrencia.find().forEach( function(doc) { 
  doc.ocodataocorrencia = ISODate(doc.ocodataocorrencia);
  db.ocorrencia.save(doc);
});'

#echo "Compressing database"
#mongo rodovias --eval 'db.getCollectionNames().forEach( function(d){ db.runCommand({compact: d, paddingFactor: 4})} )'