const express = require("express");
const bcrypt = require("bcrypt");
var mysql = require("mysql");
var cors = require("cors");
const dotenv = require("dotenv");
var jwt = require("jsonwebtoken");

const port = 4000;

var dbase = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: null,
  database: "radnet",
});
const app = express();
dbase.connect();
dotenv.config();
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.post("/login", (req, res) => {
  let email = req.body.email;
  let password = req.body.password;
  dbase.query(
    "SELECT * FROM utilizadores WHERE Email=?",
    [email],
    (err, resultDB1) => {
      if (err) throw error;
      if (resultDB1.length > 0) {
        bcrypt.compare(password, resultDB1[0].Password, (err, resultComp) => {
          if (err) throw err;
          if (resultComp) {
            const ID = resultDB1[0].IDU;
            const token = jwt.sign({ ID }, process.env.SECRET_KEY_JWT, {
              expiresIn: "1 day",
            });
            res.send({
              ack: 1,
              user: resultDB1[0].Email,
              token: token,
            });
          } else {
            res.send({
              ack: 0,
              message: "Wrong Credentials",
            });
          }
        });
      } else {
        res.send({
          ack: 0,
          message: "Wrong Credentials",
        });
      }
    }
  );
});
app.post("/register", (req, res) => {
  let email = req.body.email;
  let password = req.body.password;
  dbase.query(
    "SELECT Email FROM utilizadores WHERE Email=?",
    [email],
    (err, resdb1) => {
      if (err) throw err;
      if (resdb1.length === 0) {
        bcrypt.hash(password, 10, (err, hash) => {
          if (err) throw err;
          dbase.query(
            "INSERT INTO utilizadores (Email,Password) Values (?,?)",
            [email, hash],
            (err, resultDB) => {
              if (err) throw err;
              res.send({ ack: 1 });
            }
          );
        });
      } else {
        res.send({ ack: 0, message: "Conta já existe com esse email!" });
      }
    }
  );
});
const verifyJWT = (req, res, next) => {
  var token = req.headers.authorization.split(" ")[1];
  if (!token) {
    res.status(401).json({ message: "Nenhum token recebido!" });
  } else {
    jwt.verify(token, process.env.SECRET_KEY_JWT, (err, decoded) => {
      if (err) {
        console.log(err);
        res.status(401).json({ auth: false, message: "Não autorizado!" });
      } else {
        req.userId = decoded.id;
        next();
      }
    });
  }
};

//ROUTES PROTEGIDAS
app.get("/getCities/:data", verifyJWT, (req, res) => {
  let data = req.params.data;
  console.log(data);
  dbase.query(
    "SELECT Final.*, alertas.Tipo, alertas.Risco FROM (SELECT   localizacoes.X,   localizacoes.Y,   localizacoes.Nome,   cidadeInfo.Valor,   cidadeInfo.IDL,   cidadeInfo.Valor_Referencia FROM   localizacoes,   (    SELECT       IDC,       leituraswIDE.Valor,       leituraswIDE.IDL,       Valor_Referencia     FROM       estacoes,       (        SELECT           IDE,           leituras.*         FROM           sensores,           (            SELECT               Valor,               IDS,               IDL             FROM               leituras_radiacao             WHERE               DATA = '" +
      data +
      "'          ) AS leituras         WHERE           leituras.IDS = sensores.IDS      ) AS leituraswIDE     WHERE       estacoes.IDE = leituraswIDE.IDE  ) AS cidadeInfo WHERE localizacoes.IDC = cidadeInfo.IDC) AS Final LEFT JOIN alertas ON Final.IDL=alertas.IDL;",
    (err, resDB0) => {
      if (err) throw err;
      res.send(resDB0);
    }
  );
});
app.get("/getLastReadingDate", verifyJWT, (req, res) => {
  //SELECT Data FROM leituras_radiacao WHERE Data=(SELECT MAX(Data) FROM leituras_radiacao)
  dbase.query(
    "SELECT Data FROM leituras_radiacao WHERE Data=(SELECT MAX(Data) FROM leituras_radiacao);",
    (err, resDB0) => {
      if (err) throw err;
      res.send(resDB0[0].Data);
    }
  );
});
app.post("/addCity", verifyJWT, (req, res) => {
  let Nome = req.body.Nome;
  let X = req.body.X;
  let Y = req.body.Y;
  dbase.query(
    "SELECT Nome FROM localizacoes WHERE Nome=?",
    [Nome],
    (err, resdb1) => {
      if (err) throw err;
      if (resdb1.length == 0) {
        dbase.query(
          "Insert Into localizacoes (Nome,X,Y) VALUES(?,?,?) ",
          [Nome, X, Y],
          (err, resDB) => {
            if (err) throw err;
            res.status(201).json({ ack: 1 });
          }
        );
      } else {
        res
          .status(201)
          .json({ ack: 0, message: "Cidade já existe na base de dados!" });
      }
    }
  );
});
app.post("/addStation", verifyJWT, (req, res) => {
  let Nome = req.body.Station_cityname;
  let data_instalacao = req.body.Station_datainstalacao;
  let tipo = req.body.Station_tipo;
  let freqleitura = req.body.Station_freqleitura + ":00";
  dbase.query(
    "SELECT IDC FROM localizacoes WHERE Nome=?",
    [Nome],
    (err, resdb1) => {
      if (err) throw err;
      if (resdb1.length > 0) {
        dbase.query(
          "Insert Into estacoes (Tipo_Estacao,Qtd_Sensores,Data_Instalacao,Freq_Leitura,Valor_Referencia,IDC) VALUES(?,0,?,?,0," +
            resdb1[0].IDC +
            ")",
          [tipo, data_instalacao, freqleitura],
          (err, resDB) => {
            if (err) throw err;
            res.status(201).json({ ack: 1 });
          }
        );
      } else {
        res.status(201).json({ ack: 0, message: "Cidade não existe!" });
      }
    }
  );
});
app.post("/addSensor", verifyJWT, (req, res) => {
  let IDE = req.body.Sensor_IDE;
  let max_s = req.body.Sensor_MaxS;
  let min_s = req.body.Sensor_MinS;
  dbase.query("SELECT * FROM estacoes WHERE IDE=?", [IDE], (err, resdb1) => {
    if (err) throw err;
    if (resdb1.length > 0) {
      dbase.query(
        "Insert Into sensores (IDE,Max_S,Min_S) VALUES(?,?,?)",
        [IDE, max_s, min_s],
        (err, resDB) => {
          if (err) throw err;
          res.status(201).json({ ack: 1 });
        }
      );
    } else {
      res.status(201).json({ ack: 0, message: "Estação IDE não encontrado!" });
    }
  });
});
app.post("/addSensorReading", verifyJWT, (req, res) => {
  let IDS = req.body.Reading_IDS;
  let data = req.body.Reading_Data;
  let value = req.body.Reading_Value;
  dbase.query("SELECT * FROM sensores WHERE IDS=?", [IDS], (err, resdb1) => {
    if (err) throw err;
    if (resdb1.length > 0) {
      dbase.query(
        "SELECT * FROM leituras_radiacao WHERE IDS=? AND Data=?",
        [IDS, data],
        (err, resdb2) => {
          if (resdb2.length == 0) {
            dbase.query(
              "Insert Into leituras_radiacao (IDS,Data,Valor) VALUES(?,?,?)",
              [IDS, data, value],
              (err, resDB) => {
                if (err) throw err;
                res.status(201).json({ ack: 1 });
              }
            );
          } else {
            res.status(201).json({
              ack: 0,
              message: "Já existe uma leitura para este sensor nesta data!",
            });
          }
        }
      );
    } else {
      res.status(201).json({ ack: 0, message: "Sensor não encontrado!" });
    }
  });
});
app.get("/getGeralView", verifyJWT, (req, res) => {
  dbase.query("SELECT * FROM geralview", (err, resdb1) => {
    if (err) throw err;
    res.send(resdb1);
  });
});
app.get("/getAlertasView", verifyJWT, (req, res) => {
  dbase.query("SELECT * FROM alertasview", (err, resdb1) => {
    if (err) throw err;
    res.send(resdb1);
  });
});
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
