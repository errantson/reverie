var mh = Object.defineProperty;
var Sc = (t) => {
  throw TypeError(t);
};
var _h = (t, e, r) => e in t ? mh(t, e, { enumerable: !0, configurable: !0, writable: !0, value: r }) : t[e] = r;
var Z = (t, e, r) => _h(t, typeof e != "symbol" ? e + "" : e, r), Co = (t, e, r) => e.has(t) || Sc("Cannot " + r);
var h = (t, e, r) => (Co(t, e, "read from private field"), r ? r.call(t) : e.get(t)), K = (t, e, r) => e.has(t) ? Sc("Cannot add the same private member more than once") : e instanceof WeakSet ? e.add(t) : e.set(t, r), k = (t, e, r, n) => (Co(t, e, "write to private field"), n ? n.call(t, r) : e.set(t, r), r), I = (t, e, r) => (Co(t, e, "access private method"), r);
var Cs = (t, e, r, n) => ({
  set _(s) {
    k(t, e, s, r);
  },
  get _() {
    return h(t, e, n);
  }
});
var v = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function Kd(t) {
  if (t.__esModule) return t;
  var e = t.default;
  if (typeof e == "function") {
    var r = function n() {
      return this instanceof n ? Reflect.construct(e, arguments, this.constructor) : e.apply(this, arguments);
    };
    r.prototype = e.prototype;
  } else r = {};
  return Object.defineProperty(r, "__esModule", { value: !0 }), Object.keys(t).forEach(function(n) {
    var s = Object.getOwnPropertyDescriptor(t, n);
    Object.defineProperty(r, n, s.get ? s : {
      enumerable: !0,
      get: function() {
        return t[n];
      }
    });
  }), r;
}
var xd = {}, qr = function(t) {
  return t && t.Math === Math && t;
}, Qe = (
  // eslint-disable-next-line es/no-global-this -- safe
  qr(typeof globalThis == "object" && globalThis) || qr(typeof window == "object" && window) || // eslint-disable-next-line no-restricted-globals -- safe
  qr(typeof self == "object" && self) || qr(typeof v == "object" && v) || qr(typeof v == "object" && v) || // eslint-disable-next-line no-new-func -- fallback
  /* @__PURE__ */ function() {
    return this;
  }() || Function("return this")()
), gh = Qe, wh = gh, Ir = function(t) {
  try {
    return !!t();
  } catch {
    return !0;
  }
}, vh = Ir, Ld = !vh(function() {
  var t = (function() {
  }).bind();
  return typeof t != "function" || t.hasOwnProperty("prototype");
}), Nd = Ld, Wd = Function.prototype, hi = Wd.call, bh = Nd && Wd.bind.bind(hi, hi), Tn = Nd ? bh : function(t) {
  return function() {
    return hi.apply(t, arguments);
  };
}, Hd = function(t) {
  return t == null;
}, Sh = Hd, Eh = TypeError, Jd = function(t) {
  if (Sh(t)) throw new Eh("Can't call method on " + t);
  return t;
}, Ah = Jd, Ph = Object, Ih = function(t) {
  return Ph(Ah(t));
}, Ch = Tn, Oh = Ih, Th = Ch({}.hasOwnProperty), Ui = Object.hasOwn || function(e, r) {
  return Th(Oh(e), r);
}, Zd = {}, Fd = { exports: {} }, Ec = Qe, Rh = Object.defineProperty, kh = function(t, e) {
  try {
    Rh(Ec, t, { value: e, configurable: !0, writable: !0 });
  } catch {
    Ec[t] = e;
  }
  return e;
}, jh = Qe, Dh = kh, Ac = "__core-js_shared__", Pc = Fd.exports = jh[Ac] || Dh(Ac, {});
(Pc.versions || (Pc.versions = [])).push({
  version: "3.46.0",
  mode: "global",
  copyright: "© 2014-2025 Denis Pushkarev (zloirock.ru), 2025 CoreJS Company (core-js.io)",
  license: "https://github.com/zloirock/core-js/blob/v3.46.0/LICENSE",
  source: "https://github.com/zloirock/core-js"
});
var zh = Fd.exports, Ic = zh, $h = function(t, e) {
  return Ic[t] || (Ic[t] = e || {});
}, Mh = Tn, Uh = 0, Kh = Math.random(), xh = Mh(1.1.toString), Lh = function(t) {
  return "Symbol(" + (t === void 0 ? "" : t) + ")_" + xh(++Uh + Kh, 36);
}, Nh = Qe, Cc = Nh.navigator, Oc = Cc && Cc.userAgent, Wh = Oc ? String(Oc) : "", Bd = Qe, Oo = Wh, Tc = Bd.process, Rc = Bd.Deno, kc = Tc && Tc.versions || Rc && Rc.version, jc = kc && kc.v8, Ve, ra;
jc && (Ve = jc.split("."), ra = Ve[0] > 0 && Ve[0] < 4 ? 1 : +(Ve[0] + Ve[1]));
!ra && Oo && (Ve = Oo.match(/Edge\/(\d+)/), (!Ve || Ve[1] >= 74) && (Ve = Oo.match(/Chrome\/(\d+)/), Ve && (ra = +Ve[1])));
var Hh = ra, Dc = Hh, Jh = Ir, Zh = Qe, Fh = Zh.String, Vd = !!Object.getOwnPropertySymbols && !Jh(function() {
  var t = Symbol("symbol detection");
  return !Fh(t) || !(Object(t) instanceof Symbol) || // Chrome 38-40 symbols are not inherited from DOM collections prototypes to instances
  !Symbol.sham && Dc && Dc < 41;
}), Bh = Vd, qd = Bh && !Symbol.sham && typeof Symbol.iterator == "symbol", Vh = Qe, qh = $h, zc = Ui, Gh = Lh, Yh = Vd, Xh = qd, yr = Vh.Symbol, To = qh("wks"), Qh = Xh ? yr.for || yr : yr && yr.withoutSetter || Gh, Gd = function(t) {
  return zc(To, t) || (To[t] = Yh && zc(yr, t) ? yr[t] : Qh("Symbol." + t)), To[t];
}, ef = Gd;
Zd.f = ef;
var ba = {}, tf = Ir, Sa = !tf(function() {
  return Object.defineProperty({}, 1, { get: function() {
    return 7;
  } })[1] !== 7;
}), Ro = typeof document == "object" && document.all, Rn = typeof Ro > "u" && Ro !== void 0 ? function(t) {
  return typeof t == "function" || t === Ro;
} : function(t) {
  return typeof t == "function";
}, rf = Rn, Ea = function(t) {
  return typeof t == "object" ? t !== null : rf(t);
}, nf = Qe, $c = Ea, fi = nf.document, sf = $c(fi) && $c(fi.createElement), af = function(t) {
  return sf ? fi.createElement(t) : {};
}, of = Sa, cf = Ir, df = af, Yd = !of && !cf(function() {
  return Object.defineProperty(df("div"), "a", {
    get: function() {
      return 7;
    }
  }).a !== 7;
}), uf = Sa, lf = Ir, hf = uf && lf(function() {
  return Object.defineProperty(function() {
  }, "prototype", {
    value: 42,
    writable: !1
  }).prototype !== 42;
}), ff = Ea, pf = String, yf = TypeError, mf = function(t) {
  if (ff(t)) return t;
  throw new yf(pf(t) + " is not an object");
}, _f = Ld, Os = Function.prototype.call, Ki = _f ? Os.bind(Os) : function() {
  return Os.apply(Os, arguments);
}, ko = Qe, gf = Rn, wf = function(t) {
  return gf(t) ? t : void 0;
}, vf = function(t, e) {
  return arguments.length < 2 ? wf(ko[t]) : ko[t] && ko[t][e];
}, bf = Tn, Sf = bf({}.isPrototypeOf), Ef = vf, Af = Rn, Pf = Sf, If = qd, Cf = Object, Xd = If ? function(t) {
  return typeof t == "symbol";
} : function(t) {
  var e = Ef("Symbol");
  return Af(e) && Pf(e.prototype, Cf(t));
}, Of = String, Tf = function(t) {
  try {
    return Of(t);
  } catch {
    return "Object";
  }
}, Rf = Rn, kf = Tf, jf = TypeError, Df = function(t) {
  if (Rf(t)) return t;
  throw new jf(kf(t) + " is not a function");
}, zf = Df, $f = Hd, Mf = function(t, e) {
  var r = t[e];
  return $f(r) ? void 0 : zf(r);
}, jo = Ki, Do = Rn, zo = Ea, Uf = TypeError, Kf = function(t, e) {
  var r, n;
  if (e === "string" && Do(r = t.toString) && !zo(n = jo(r, t)) || Do(r = t.valueOf) && !zo(n = jo(r, t)) || e !== "string" && Do(r = t.toString) && !zo(n = jo(r, t))) return n;
  throw new Uf("Can't convert object to primitive value");
}, xf = Ki, Mc = Ea, Uc = Xd, Lf = Mf, Nf = Kf, Wf = Gd, Hf = TypeError, Jf = Wf("toPrimitive"), Zf = function(t, e) {
  if (!Mc(t) || Uc(t)) return t;
  var r = Lf(t, Jf), n;
  if (r) {
    if (e === void 0 && (e = "default"), n = xf(r, t, e), !Mc(n) || Uc(n)) return n;
    throw new Hf("Can't convert object to primitive value");
  }
  return e === void 0 && (e = "number"), Nf(t, e);
}, Ff = Zf, Bf = Xd, Qd = function(t) {
  var e = Ff(t, "string");
  return Bf(e) ? e : e + "";
}, Vf = Sa, qf = Yd, Gf = hf, Ts = mf, Kc = Qd, Yf = TypeError, $o = Object.defineProperty, Xf = Object.getOwnPropertyDescriptor, Mo = "enumerable", Uo = "configurable", Ko = "writable";
ba.f = Vf ? Gf ? function(e, r, n) {
  if (Ts(e), r = Kc(r), Ts(n), typeof e == "function" && r === "prototype" && "value" in n && Ko in n && !n[Ko]) {
    var s = Xf(e, r);
    s && s[Ko] && (e[r] = n.value, n = {
      configurable: Uo in n ? n[Uo] : s[Uo],
      enumerable: Mo in n ? n[Mo] : s[Mo],
      writable: !1
    });
  }
  return $o(e, r, n);
} : $o : function(e, r, n) {
  if (Ts(e), r = Kc(r), Ts(n), qf) try {
    return $o(e, r, n);
  } catch {
  }
  if ("get" in n || "set" in n) throw new Yf("Accessors not supported");
  return "value" in n && (e[r] = n.value), e;
};
var xc = wh, Qf = Ui, ep = Zd, tp = ba.f, eu = function(t) {
  var e = xc.Symbol || (xc.Symbol = {});
  Qf(e, t) || tp(e, t, {
    value: ep.f(t)
  });
}, xi = {}, tu = {}, ru = {}.propertyIsEnumerable, nu = Object.getOwnPropertyDescriptor, rp = nu && !ru.call({ 1: 2 }, 1);
tu.f = rp ? function(e) {
  var r = nu(this, e);
  return !!r && r.enumerable;
} : ru;
var np = function(t, e) {
  return {
    enumerable: !(t & 1),
    configurable: !(t & 2),
    writable: !(t & 4),
    value: e
  };
}, su = Tn, sp = su({}.toString), ap = su("".slice), op = function(t) {
  return ap(sp(t), 8, -1);
}, ip = Tn, cp = Ir, dp = op, xo = Object, up = ip("".split), lp = cp(function() {
  return !xo("z").propertyIsEnumerable(0);
}) ? function(t) {
  return dp(t) === "String" ? up(t, "") : xo(t);
} : xo, hp = lp, fp = Jd, pp = function(t) {
  return hp(fp(t));
}, yp = Sa, mp = Ki, _p = tu, gp = np, wp = pp, vp = Qd, bp = Ui, Sp = Yd, Lc = Object.getOwnPropertyDescriptor;
xi.f = yp ? Lc : function(e, r) {
  if (e = wp(e), r = vp(r), Sp) try {
    return Lc(e, r);
  } catch {
  }
  if (bp(e, r)) return gp(!mp(_p.f, e, r), e[r]);
};
var Ep = Qe, Ap = eu, Pp = ba.f, Ip = xi.f, Lo = Ep.Symbol;
Ap("asyncDispose");
if (Lo) {
  var Rs = Ip(Lo, "asyncDispose");
  Rs.enumerable && Rs.configurable && Rs.writable && Pp(Lo, "asyncDispose", { value: Rs.value, enumerable: !1, configurable: !1, writable: !1 });
}
var Cp = Qe, Op = eu, Tp = ba.f, Rp = xi.f, No = Cp.Symbol;
Op("dispose");
if (No) {
  var ks = Rp(No, "dispose");
  ks.enumerable && ks.configurable && ks.writable && Tp(No, "dispose", { value: ks.value, enumerable: !1, configurable: !1, writable: !1 });
}
var Aa = {}, Pa = {}, ct = {}, R = {}, pi = {}, xt = {}, Ia = {}, rt = {}, kn = {};
(function(t) {
  Object.defineProperty(t, "__esModule", { value: !0 }), t.getParsedType = t.ZodParsedType = t.objectUtil = t.util = void 0;
  var e;
  (function(s) {
    s.assertEqual = (c) => {
    };
    function a(c) {
    }
    s.assertIs = a;
    function o(c) {
      throw new Error();
    }
    s.assertNever = o, s.arrayToEnum = (c) => {
      const d = {};
      for (const u of c)
        d[u] = u;
      return d;
    }, s.getValidEnumValues = (c) => {
      const d = s.objectKeys(c).filter((l) => typeof c[c[l]] != "number"), u = {};
      for (const l of d)
        u[l] = c[l];
      return s.objectValues(u);
    }, s.objectValues = (c) => s.objectKeys(c).map(function(d) {
      return c[d];
    }), s.objectKeys = typeof Object.keys == "function" ? (c) => Object.keys(c) : (c) => {
      const d = [];
      for (const u in c)
        Object.prototype.hasOwnProperty.call(c, u) && d.push(u);
      return d;
    }, s.find = (c, d) => {
      for (const u of c)
        if (d(u))
          return u;
    }, s.isInteger = typeof Number.isInteger == "function" ? (c) => Number.isInteger(c) : (c) => typeof c == "number" && Number.isFinite(c) && Math.floor(c) === c;
    function i(c, d = " | ") {
      return c.map((u) => typeof u == "string" ? `'${u}'` : u).join(d);
    }
    s.joinValues = i, s.jsonStringifyReplacer = (c, d) => typeof d == "bigint" ? d.toString() : d;
  })(e || (t.util = e = {}));
  var r;
  (function(s) {
    s.mergeShapes = (a, o) => ({
      ...a,
      ...o
      // second overwrites first
    });
  })(r || (t.objectUtil = r = {})), t.ZodParsedType = e.arrayToEnum([
    "string",
    "nan",
    "number",
    "integer",
    "float",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "function",
    "undefined",
    "null",
    "array",
    "object",
    "unknown",
    "promise",
    "void",
    "never",
    "map",
    "set"
  ]);
  const n = (s) => {
    switch (typeof s) {
      case "undefined":
        return t.ZodParsedType.undefined;
      case "string":
        return t.ZodParsedType.string;
      case "number":
        return Number.isNaN(s) ? t.ZodParsedType.nan : t.ZodParsedType.number;
      case "boolean":
        return t.ZodParsedType.boolean;
      case "function":
        return t.ZodParsedType.function;
      case "bigint":
        return t.ZodParsedType.bigint;
      case "symbol":
        return t.ZodParsedType.symbol;
      case "object":
        return Array.isArray(s) ? t.ZodParsedType.array : s === null ? t.ZodParsedType.null : s.then && typeof s.then == "function" && s.catch && typeof s.catch == "function" ? t.ZodParsedType.promise : typeof Map < "u" && s instanceof Map ? t.ZodParsedType.map : typeof Set < "u" && s instanceof Set ? t.ZodParsedType.set : typeof Date < "u" && s instanceof Date ? t.ZodParsedType.date : t.ZodParsedType.object;
      default:
        return t.ZodParsedType.unknown;
    }
  };
  t.getParsedType = n;
})(kn);
Object.defineProperty(rt, "__esModule", { value: !0 });
rt.ZodError = rt.quotelessJson = rt.ZodIssueCode = void 0;
const au = kn;
rt.ZodIssueCode = au.util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
const kp = (t) => JSON.stringify(t, null, 2).replace(/"([^"]+)":/g, "$1:");
rt.quotelessJson = kp;
class hn extends Error {
  get errors() {
    return this.issues;
  }
  constructor(e) {
    super(), this.issues = [], this.addIssue = (n) => {
      this.issues = [...this.issues, n];
    }, this.addIssues = (n = []) => {
      this.issues = [...this.issues, ...n];
    };
    const r = new.target.prototype;
    Object.setPrototypeOf ? Object.setPrototypeOf(this, r) : this.__proto__ = r, this.name = "ZodError", this.issues = e;
  }
  format(e) {
    const r = e || function(a) {
      return a.message;
    }, n = { _errors: [] }, s = (a) => {
      for (const o of a.issues)
        if (o.code === "invalid_union")
          o.unionErrors.map(s);
        else if (o.code === "invalid_return_type")
          s(o.returnTypeError);
        else if (o.code === "invalid_arguments")
          s(o.argumentsError);
        else if (o.path.length === 0)
          n._errors.push(r(o));
        else {
          let i = n, c = 0;
          for (; c < o.path.length; ) {
            const d = o.path[c];
            c === o.path.length - 1 ? (i[d] = i[d] || { _errors: [] }, i[d]._errors.push(r(o))) : i[d] = i[d] || { _errors: [] }, i = i[d], c++;
          }
        }
    };
    return s(this), n;
  }
  static assert(e) {
    if (!(e instanceof hn))
      throw new Error(`Not a ZodError: ${e}`);
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, au.util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(e = (r) => r.message) {
    const r = {}, n = [];
    for (const s of this.issues)
      if (s.path.length > 0) {
        const a = s.path[0];
        r[a] = r[a] || [], r[a].push(e(s));
      } else
        n.push(e(s));
    return { formErrors: n, fieldErrors: r };
  }
  get formErrors() {
    return this.flatten();
  }
}
rt.ZodError = hn;
hn.create = (t) => new hn(t);
Object.defineProperty(Ia, "__esModule", { value: !0 });
const ge = rt, Wt = kn, jp = (t, e) => {
  let r;
  switch (t.code) {
    case ge.ZodIssueCode.invalid_type:
      t.received === Wt.ZodParsedType.undefined ? r = "Required" : r = `Expected ${t.expected}, received ${t.received}`;
      break;
    case ge.ZodIssueCode.invalid_literal:
      r = `Invalid literal value, expected ${JSON.stringify(t.expected, Wt.util.jsonStringifyReplacer)}`;
      break;
    case ge.ZodIssueCode.unrecognized_keys:
      r = `Unrecognized key(s) in object: ${Wt.util.joinValues(t.keys, ", ")}`;
      break;
    case ge.ZodIssueCode.invalid_union:
      r = "Invalid input";
      break;
    case ge.ZodIssueCode.invalid_union_discriminator:
      r = `Invalid discriminator value. Expected ${Wt.util.joinValues(t.options)}`;
      break;
    case ge.ZodIssueCode.invalid_enum_value:
      r = `Invalid enum value. Expected ${Wt.util.joinValues(t.options)}, received '${t.received}'`;
      break;
    case ge.ZodIssueCode.invalid_arguments:
      r = "Invalid function arguments";
      break;
    case ge.ZodIssueCode.invalid_return_type:
      r = "Invalid function return type";
      break;
    case ge.ZodIssueCode.invalid_date:
      r = "Invalid date";
      break;
    case ge.ZodIssueCode.invalid_string:
      typeof t.validation == "object" ? "includes" in t.validation ? (r = `Invalid input: must include "${t.validation.includes}"`, typeof t.validation.position == "number" && (r = `${r} at one or more positions greater than or equal to ${t.validation.position}`)) : "startsWith" in t.validation ? r = `Invalid input: must start with "${t.validation.startsWith}"` : "endsWith" in t.validation ? r = `Invalid input: must end with "${t.validation.endsWith}"` : Wt.util.assertNever(t.validation) : t.validation !== "regex" ? r = `Invalid ${t.validation}` : r = "Invalid";
      break;
    case ge.ZodIssueCode.too_small:
      t.type === "array" ? r = `Array must contain ${t.exact ? "exactly" : t.inclusive ? "at least" : "more than"} ${t.minimum} element(s)` : t.type === "string" ? r = `String must contain ${t.exact ? "exactly" : t.inclusive ? "at least" : "over"} ${t.minimum} character(s)` : t.type === "number" ? r = `Number must be ${t.exact ? "exactly equal to " : t.inclusive ? "greater than or equal to " : "greater than "}${t.minimum}` : t.type === "bigint" ? r = `Number must be ${t.exact ? "exactly equal to " : t.inclusive ? "greater than or equal to " : "greater than "}${t.minimum}` : t.type === "date" ? r = `Date must be ${t.exact ? "exactly equal to " : t.inclusive ? "greater than or equal to " : "greater than "}${new Date(Number(t.minimum))}` : r = "Invalid input";
      break;
    case ge.ZodIssueCode.too_big:
      t.type === "array" ? r = `Array must contain ${t.exact ? "exactly" : t.inclusive ? "at most" : "less than"} ${t.maximum} element(s)` : t.type === "string" ? r = `String must contain ${t.exact ? "exactly" : t.inclusive ? "at most" : "under"} ${t.maximum} character(s)` : t.type === "number" ? r = `Number must be ${t.exact ? "exactly" : t.inclusive ? "less than or equal to" : "less than"} ${t.maximum}` : t.type === "bigint" ? r = `BigInt must be ${t.exact ? "exactly" : t.inclusive ? "less than or equal to" : "less than"} ${t.maximum}` : t.type === "date" ? r = `Date must be ${t.exact ? "exactly" : t.inclusive ? "smaller than or equal to" : "smaller than"} ${new Date(Number(t.maximum))}` : r = "Invalid input";
      break;
    case ge.ZodIssueCode.custom:
      r = "Invalid input";
      break;
    case ge.ZodIssueCode.invalid_intersection_types:
      r = "Intersection results could not be merged";
      break;
    case ge.ZodIssueCode.not_multiple_of:
      r = `Number must be a multiple of ${t.multipleOf}`;
      break;
    case ge.ZodIssueCode.not_finite:
      r = "Number must be finite";
      break;
    default:
      r = e.defaultError, Wt.util.assertNever(t);
  }
  return { message: r };
};
Ia.default = jp;
var Dp = v && v.__importDefault || function(t) {
  return t && t.__esModule ? t : { default: t };
};
Object.defineProperty(xt, "__esModule", { value: !0 });
xt.defaultErrorMap = void 0;
xt.setErrorMap = zp;
xt.getErrorMap = $p;
const ou = Dp(Ia);
xt.defaultErrorMap = ou.default;
let iu = ou.default;
function zp(t) {
  iu = t;
}
function $p() {
  return iu;
}
var Li = {};
(function(t) {
  var e = v && v.__importDefault || function(f) {
    return f && f.__esModule ? f : { default: f };
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), t.isAsync = t.isValid = t.isDirty = t.isAborted = t.OK = t.DIRTY = t.INVALID = t.ParseStatus = t.EMPTY_PATH = t.makeIssue = void 0, t.addIssueToContext = a;
  const r = xt, n = e(Ia), s = (f) => {
    const { data: _, path: g, errorMaps: S, issueData: w } = f, b = [...g, ...w.path || []], D = {
      ...w,
      path: b
    };
    if (w.message !== void 0)
      return {
        ...w,
        path: b,
        message: w.message
      };
    let N = "";
    const oe = S.filter((Ce) => !!Ce).slice().reverse();
    for (const Ce of oe)
      N = Ce(D, { data: _, defaultError: N }).message;
    return {
      ...w,
      path: b,
      message: N
    };
  };
  t.makeIssue = s, t.EMPTY_PATH = [];
  function a(f, _) {
    const g = (0, r.getErrorMap)(), S = (0, t.makeIssue)({
      issueData: _,
      data: f.data,
      path: f.path,
      errorMaps: [
        f.common.contextualErrorMap,
        // contextual error map is first priority
        f.schemaErrorMap,
        // then schema-bound map if available
        g,
        // then global override map
        g === n.default ? void 0 : n.default
        // then global default map
      ].filter((w) => !!w)
    });
    f.common.issues.push(S);
  }
  class o {
    constructor() {
      this.value = "valid";
    }
    dirty() {
      this.value === "valid" && (this.value = "dirty");
    }
    abort() {
      this.value !== "aborted" && (this.value = "aborted");
    }
    static mergeArray(_, g) {
      const S = [];
      for (const w of g) {
        if (w.status === "aborted")
          return t.INVALID;
        w.status === "dirty" && _.dirty(), S.push(w.value);
      }
      return { status: _.value, value: S };
    }
    static async mergeObjectAsync(_, g) {
      const S = [];
      for (const w of g) {
        const b = await w.key, D = await w.value;
        S.push({
          key: b,
          value: D
        });
      }
      return o.mergeObjectSync(_, S);
    }
    static mergeObjectSync(_, g) {
      const S = {};
      for (const w of g) {
        const { key: b, value: D } = w;
        if (b.status === "aborted" || D.status === "aborted")
          return t.INVALID;
        b.status === "dirty" && _.dirty(), D.status === "dirty" && _.dirty(), b.value !== "__proto__" && (typeof D.value < "u" || w.alwaysSet) && (S[b.value] = D.value);
      }
      return { status: _.value, value: S };
    }
  }
  t.ParseStatus = o, t.INVALID = Object.freeze({
    status: "aborted"
  });
  const i = (f) => ({ status: "dirty", value: f });
  t.DIRTY = i;
  const c = (f) => ({ status: "valid", value: f });
  t.OK = c;
  const d = (f) => f.status === "aborted";
  t.isAborted = d;
  const u = (f) => f.status === "dirty";
  t.isDirty = u;
  const l = (f) => f.status === "valid";
  t.isValid = l;
  const p = (f) => typeof Promise < "u" && f instanceof Promise;
  t.isAsync = p;
})(Li);
var cu = {};
Object.defineProperty(cu, "__esModule", { value: !0 });
var y = {}, Ca = {};
Object.defineProperty(Ca, "__esModule", { value: !0 });
Ca.errorUtil = void 0;
var Nc;
(function(t) {
  t.errToObj = (e) => typeof e == "string" ? { message: e } : e || {}, t.toString = (e) => typeof e == "string" ? e : e == null ? void 0 : e.message;
})(Nc || (Ca.errorUtil = Nc = {}));
Object.defineProperty(y, "__esModule", { value: !0 });
y.discriminatedUnion = y.date = y.boolean = y.bigint = y.array = y.any = y.coerce = y.ZodFirstPartyTypeKind = y.late = y.ZodSchema = y.Schema = y.ZodReadonly = y.ZodPipeline = y.ZodBranded = y.BRAND = y.ZodNaN = y.ZodCatch = y.ZodDefault = y.ZodNullable = y.ZodOptional = y.ZodTransformer = y.ZodEffects = y.ZodPromise = y.ZodNativeEnum = y.ZodEnum = y.ZodLiteral = y.ZodLazy = y.ZodFunction = y.ZodSet = y.ZodMap = y.ZodRecord = y.ZodTuple = y.ZodIntersection = y.ZodDiscriminatedUnion = y.ZodUnion = y.ZodObject = y.ZodArray = y.ZodVoid = y.ZodNever = y.ZodUnknown = y.ZodAny = y.ZodNull = y.ZodUndefined = y.ZodSymbol = y.ZodDate = y.ZodBoolean = y.ZodBigInt = y.ZodNumber = y.ZodString = y.ZodType = void 0;
y.NEVER = y.void = y.unknown = y.union = y.undefined = y.tuple = y.transformer = y.symbol = y.string = y.strictObject = y.set = y.record = y.promise = y.preprocess = y.pipeline = y.ostring = y.optional = y.onumber = y.oboolean = y.object = y.number = y.nullable = y.null = y.never = y.nativeEnum = y.nan = y.map = y.literal = y.lazy = y.intersection = y.instanceof = y.function = y.enum = y.effect = void 0;
y.datetimeRegex = lu;
y.custom = fu;
const E = rt, js = xt, O = Ca, m = Li, A = kn;
class st {
  constructor(e, r, n, s) {
    this._cachedPath = [], this.parent = e, this.data = r, this._path = n, this._key = s;
  }
  get path() {
    return this._cachedPath.length || (Array.isArray(this._key) ? this._cachedPath.push(...this._path, ...this._key) : this._cachedPath.push(...this._path, this._key)), this._cachedPath;
  }
}
const Wc = (t, e) => {
  if ((0, m.isValid)(e))
    return { success: !0, data: e.value };
  if (!t.common.issues.length)
    throw new Error("Validation failed but no issues detected.");
  return {
    success: !1,
    get error() {
      if (this._error)
        return this._error;
      const r = new E.ZodError(t.common.issues);
      return this._error = r, this._error;
    }
  };
};
function $(t) {
  if (!t)
    return {};
  const { errorMap: e, invalid_type_error: r, required_error: n, description: s } = t;
  if (e && (r || n))
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  return e ? { errorMap: e, description: s } : { errorMap: (o, i) => {
    const { message: c } = t;
    return o.code === "invalid_enum_value" ? { message: c ?? i.defaultError } : typeof i.data > "u" ? { message: c ?? n ?? i.defaultError } : o.code !== "invalid_type" ? { message: i.defaultError } : { message: c ?? r ?? i.defaultError };
  }, description: s };
}
class U {
  get description() {
    return this._def.description;
  }
  _getType(e) {
    return (0, A.getParsedType)(e.data);
  }
  _getOrReturnCtx(e, r) {
    return r || {
      common: e.parent.common,
      data: e.data,
      parsedType: (0, A.getParsedType)(e.data),
      schemaErrorMap: this._def.errorMap,
      path: e.path,
      parent: e.parent
    };
  }
  _processInputParams(e) {
    return {
      status: new m.ParseStatus(),
      ctx: {
        common: e.parent.common,
        data: e.data,
        parsedType: (0, A.getParsedType)(e.data),
        schemaErrorMap: this._def.errorMap,
        path: e.path,
        parent: e.parent
      }
    };
  }
  _parseSync(e) {
    const r = this._parse(e);
    if ((0, m.isAsync)(r))
      throw new Error("Synchronous parse encountered promise.");
    return r;
  }
  _parseAsync(e) {
    const r = this._parse(e);
    return Promise.resolve(r);
  }
  parse(e, r) {
    const n = this.safeParse(e, r);
    if (n.success)
      return n.data;
    throw n.error;
  }
  safeParse(e, r) {
    const n = {
      common: {
        issues: [],
        async: (r == null ? void 0 : r.async) ?? !1,
        contextualErrorMap: r == null ? void 0 : r.errorMap
      },
      path: (r == null ? void 0 : r.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data: e,
      parsedType: (0, A.getParsedType)(e)
    }, s = this._parseSync({ data: e, path: n.path, parent: n });
    return Wc(n, s);
  }
  "~validate"(e) {
    var n, s;
    const r = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data: e,
      parsedType: (0, A.getParsedType)(e)
    };
    if (!this["~standard"].async)
      try {
        const a = this._parseSync({ data: e, path: [], parent: r });
        return (0, m.isValid)(a) ? {
          value: a.value
        } : {
          issues: r.common.issues
        };
      } catch (a) {
        (s = (n = a == null ? void 0 : a.message) == null ? void 0 : n.toLowerCase()) != null && s.includes("encountered") && (this["~standard"].async = !0), r.common = {
          issues: [],
          async: !0
        };
      }
    return this._parseAsync({ data: e, path: [], parent: r }).then((a) => (0, m.isValid)(a) ? {
      value: a.value
    } : {
      issues: r.common.issues
    });
  }
  async parseAsync(e, r) {
    const n = await this.safeParseAsync(e, r);
    if (n.success)
      return n.data;
    throw n.error;
  }
  async safeParseAsync(e, r) {
    const n = {
      common: {
        issues: [],
        contextualErrorMap: r == null ? void 0 : r.errorMap,
        async: !0
      },
      path: (r == null ? void 0 : r.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data: e,
      parsedType: (0, A.getParsedType)(e)
    }, s = this._parse({ data: e, path: n.path, parent: n }), a = await ((0, m.isAsync)(s) ? s : Promise.resolve(s));
    return Wc(n, a);
  }
  refine(e, r) {
    const n = (s) => typeof r == "string" || typeof r > "u" ? { message: r } : typeof r == "function" ? r(s) : r;
    return this._refinement((s, a) => {
      const o = e(s), i = () => a.addIssue({
        code: E.ZodIssueCode.custom,
        ...n(s)
      });
      return typeof Promise < "u" && o instanceof Promise ? o.then((c) => c ? !0 : (i(), !1)) : o ? !0 : (i(), !1);
    });
  }
  refinement(e, r) {
    return this._refinement((n, s) => e(n) ? !0 : (s.addIssue(typeof r == "function" ? r(n, s) : r), !1));
  }
  _refinement(e) {
    return new Ye({
      schema: this,
      typeName: j.ZodEffects,
      effect: { type: "refinement", refinement: e }
    });
  }
  superRefine(e) {
    return this._refinement(e);
  }
  constructor(e) {
    this.spa = this.safeParseAsync, this._def = e, this.parse = this.parse.bind(this), this.safeParse = this.safeParse.bind(this), this.parseAsync = this.parseAsync.bind(this), this.safeParseAsync = this.safeParseAsync.bind(this), this.spa = this.spa.bind(this), this.refine = this.refine.bind(this), this.refinement = this.refinement.bind(this), this.superRefine = this.superRefine.bind(this), this.optional = this.optional.bind(this), this.nullable = this.nullable.bind(this), this.nullish = this.nullish.bind(this), this.array = this.array.bind(this), this.promise = this.promise.bind(this), this.or = this.or.bind(this), this.and = this.and.bind(this), this.transform = this.transform.bind(this), this.brand = this.brand.bind(this), this.default = this.default.bind(this), this.catch = this.catch.bind(this), this.describe = this.describe.bind(this), this.pipe = this.pipe.bind(this), this.readonly = this.readonly.bind(this), this.isNullable = this.isNullable.bind(this), this.isOptional = this.isOptional.bind(this), this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (r) => this["~validate"](r)
    };
  }
  optional() {
    return nt.create(this, this._def);
  }
  nullable() {
    return Ut.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return Ge.create(this);
  }
  promise() {
    return Er.create(this, this._def);
  }
  or(e) {
    return mn.create([this, e], this._def);
  }
  and(e) {
    return _n.create(this, e, this._def);
  }
  transform(e) {
    return new Ye({
      ...$(this._def),
      schema: this,
      typeName: j.ZodEffects,
      effect: { type: "transform", transform: e }
    });
  }
  default(e) {
    const r = typeof e == "function" ? e : () => e;
    return new Sn({
      ...$(this._def),
      innerType: this,
      defaultValue: r,
      typeName: j.ZodDefault
    });
  }
  brand() {
    return new Ni({
      typeName: j.ZodBranded,
      type: this,
      ...$(this._def)
    });
  }
  catch(e) {
    const r = typeof e == "function" ? e : () => e;
    return new En({
      ...$(this._def),
      innerType: this,
      catchValue: r,
      typeName: j.ZodCatch
    });
  }
  describe(e) {
    const r = this.constructor;
    return new r({
      ...this._def,
      description: e
    });
  }
  pipe(e) {
    return jn.create(this, e);
  }
  readonly() {
    return An.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
y.ZodType = U;
y.Schema = U;
y.ZodSchema = U;
const Mp = /^c[^\s-]{8,}$/i, Up = /^[0-9a-z]+$/, Kp = /^[0-9A-HJKMNP-TV-Z]{26}$/i, xp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i, Lp = /^[a-z0-9_-]{21}$/i, Np = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/, Wp = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/, Hp = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i, Jp = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
let Wo;
const Zp = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, Fp = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/, Bp = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/, Vp = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/, qp = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/, Gp = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/, du = "((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))", Yp = new RegExp(`^${du}$`);
function uu(t) {
  let e = "[0-5]\\d";
  t.precision ? e = `${e}\\.\\d{${t.precision}}` : t.precision == null && (e = `${e}(\\.\\d+)?`);
  const r = t.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${e})${r}`;
}
function Xp(t) {
  return new RegExp(`^${uu(t)}$`);
}
function lu(t) {
  let e = `${du}T${uu(t)}`;
  const r = [];
  return r.push(t.local ? "Z?" : "Z"), t.offset && r.push("([+-]\\d{2}:?\\d{2})"), e = `${e}(${r.join("|")})`, new RegExp(`^${e}$`);
}
function Qp(t, e) {
  return !!((e === "v4" || !e) && Zp.test(t) || (e === "v6" || !e) && Bp.test(t));
}
function ey(t, e) {
  if (!Np.test(t))
    return !1;
  try {
    const [r] = t.split(".");
    if (!r)
      return !1;
    const n = r.replace(/-/g, "+").replace(/_/g, "/").padEnd(r.length + (4 - r.length % 4) % 4, "="), s = JSON.parse(atob(n));
    return !(typeof s != "object" || s === null || "typ" in s && (s == null ? void 0 : s.typ) !== "JWT" || !s.alg || e && s.alg !== e);
  } catch {
    return !1;
  }
}
function ty(t, e) {
  return !!((e === "v4" || !e) && Fp.test(t) || (e === "v6" || !e) && Vp.test(t));
}
class qe extends U {
  _parse(e) {
    if (this._def.coerce && (e.data = String(e.data)), this._getType(e) !== A.ZodParsedType.string) {
      const a = this._getOrReturnCtx(e);
      return (0, m.addIssueToContext)(a, {
        code: E.ZodIssueCode.invalid_type,
        expected: A.ZodParsedType.string,
        received: a.parsedType
      }), m.INVALID;
    }
    const n = new m.ParseStatus();
    let s;
    for (const a of this._def.checks)
      if (a.kind === "min")
        e.data.length < a.value && (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
          code: E.ZodIssueCode.too_small,
          minimum: a.value,
          type: "string",
          inclusive: !0,
          exact: !1,
          message: a.message
        }), n.dirty());
      else if (a.kind === "max")
        e.data.length > a.value && (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
          code: E.ZodIssueCode.too_big,
          maximum: a.value,
          type: "string",
          inclusive: !0,
          exact: !1,
          message: a.message
        }), n.dirty());
      else if (a.kind === "length") {
        const o = e.data.length > a.value, i = e.data.length < a.value;
        (o || i) && (s = this._getOrReturnCtx(e, s), o ? (0, m.addIssueToContext)(s, {
          code: E.ZodIssueCode.too_big,
          maximum: a.value,
          type: "string",
          inclusive: !0,
          exact: !0,
          message: a.message
        }) : i && (0, m.addIssueToContext)(s, {
          code: E.ZodIssueCode.too_small,
          minimum: a.value,
          type: "string",
          inclusive: !0,
          exact: !0,
          message: a.message
        }), n.dirty());
      } else if (a.kind === "email")
        Hp.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
          validation: "email",
          code: E.ZodIssueCode.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "emoji")
        Wo || (Wo = new RegExp(Jp, "u")), Wo.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
          validation: "emoji",
          code: E.ZodIssueCode.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "uuid")
        xp.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
          validation: "uuid",
          code: E.ZodIssueCode.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "nanoid")
        Lp.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
          validation: "nanoid",
          code: E.ZodIssueCode.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "cuid")
        Mp.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
          validation: "cuid",
          code: E.ZodIssueCode.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "cuid2")
        Up.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
          validation: "cuid2",
          code: E.ZodIssueCode.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "ulid")
        Kp.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
          validation: "ulid",
          code: E.ZodIssueCode.invalid_string,
          message: a.message
        }), n.dirty());
      else if (a.kind === "url")
        try {
          new URL(e.data);
        } catch {
          s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
            validation: "url",
            code: E.ZodIssueCode.invalid_string,
            message: a.message
          }), n.dirty();
        }
      else a.kind === "regex" ? (a.regex.lastIndex = 0, a.regex.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
        validation: "regex",
        code: E.ZodIssueCode.invalid_string,
        message: a.message
      }), n.dirty())) : a.kind === "trim" ? e.data = e.data.trim() : a.kind === "includes" ? e.data.includes(a.value, a.position) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
        code: E.ZodIssueCode.invalid_string,
        validation: { includes: a.value, position: a.position },
        message: a.message
      }), n.dirty()) : a.kind === "toLowerCase" ? e.data = e.data.toLowerCase() : a.kind === "toUpperCase" ? e.data = e.data.toUpperCase() : a.kind === "startsWith" ? e.data.startsWith(a.value) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
        code: E.ZodIssueCode.invalid_string,
        validation: { startsWith: a.value },
        message: a.message
      }), n.dirty()) : a.kind === "endsWith" ? e.data.endsWith(a.value) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
        code: E.ZodIssueCode.invalid_string,
        validation: { endsWith: a.value },
        message: a.message
      }), n.dirty()) : a.kind === "datetime" ? lu(a).test(e.data) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
        code: E.ZodIssueCode.invalid_string,
        validation: "datetime",
        message: a.message
      }), n.dirty()) : a.kind === "date" ? Yp.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
        code: E.ZodIssueCode.invalid_string,
        validation: "date",
        message: a.message
      }), n.dirty()) : a.kind === "time" ? Xp(a).test(e.data) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
        code: E.ZodIssueCode.invalid_string,
        validation: "time",
        message: a.message
      }), n.dirty()) : a.kind === "duration" ? Wp.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
        validation: "duration",
        code: E.ZodIssueCode.invalid_string,
        message: a.message
      }), n.dirty()) : a.kind === "ip" ? Qp(e.data, a.version) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
        validation: "ip",
        code: E.ZodIssueCode.invalid_string,
        message: a.message
      }), n.dirty()) : a.kind === "jwt" ? ey(e.data, a.alg) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
        validation: "jwt",
        code: E.ZodIssueCode.invalid_string,
        message: a.message
      }), n.dirty()) : a.kind === "cidr" ? ty(e.data, a.version) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
        validation: "cidr",
        code: E.ZodIssueCode.invalid_string,
        message: a.message
      }), n.dirty()) : a.kind === "base64" ? qp.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
        validation: "base64",
        code: E.ZodIssueCode.invalid_string,
        message: a.message
      }), n.dirty()) : a.kind === "base64url" ? Gp.test(e.data) || (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
        validation: "base64url",
        code: E.ZodIssueCode.invalid_string,
        message: a.message
      }), n.dirty()) : A.util.assertNever(a);
    return { status: n.value, value: e.data };
  }
  _regex(e, r, n) {
    return this.refinement((s) => e.test(s), {
      validation: r,
      code: E.ZodIssueCode.invalid_string,
      ...O.errorUtil.errToObj(n)
    });
  }
  _addCheck(e) {
    return new qe({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  email(e) {
    return this._addCheck({ kind: "email", ...O.errorUtil.errToObj(e) });
  }
  url(e) {
    return this._addCheck({ kind: "url", ...O.errorUtil.errToObj(e) });
  }
  emoji(e) {
    return this._addCheck({ kind: "emoji", ...O.errorUtil.errToObj(e) });
  }
  uuid(e) {
    return this._addCheck({ kind: "uuid", ...O.errorUtil.errToObj(e) });
  }
  nanoid(e) {
    return this._addCheck({ kind: "nanoid", ...O.errorUtil.errToObj(e) });
  }
  cuid(e) {
    return this._addCheck({ kind: "cuid", ...O.errorUtil.errToObj(e) });
  }
  cuid2(e) {
    return this._addCheck({ kind: "cuid2", ...O.errorUtil.errToObj(e) });
  }
  ulid(e) {
    return this._addCheck({ kind: "ulid", ...O.errorUtil.errToObj(e) });
  }
  base64(e) {
    return this._addCheck({ kind: "base64", ...O.errorUtil.errToObj(e) });
  }
  base64url(e) {
    return this._addCheck({
      kind: "base64url",
      ...O.errorUtil.errToObj(e)
    });
  }
  jwt(e) {
    return this._addCheck({ kind: "jwt", ...O.errorUtil.errToObj(e) });
  }
  ip(e) {
    return this._addCheck({ kind: "ip", ...O.errorUtil.errToObj(e) });
  }
  cidr(e) {
    return this._addCheck({ kind: "cidr", ...O.errorUtil.errToObj(e) });
  }
  datetime(e) {
    return typeof e == "string" ? this._addCheck({
      kind: "datetime",
      precision: null,
      offset: !1,
      local: !1,
      message: e
    }) : this._addCheck({
      kind: "datetime",
      precision: typeof (e == null ? void 0 : e.precision) > "u" ? null : e == null ? void 0 : e.precision,
      offset: (e == null ? void 0 : e.offset) ?? !1,
      local: (e == null ? void 0 : e.local) ?? !1,
      ...O.errorUtil.errToObj(e == null ? void 0 : e.message)
    });
  }
  date(e) {
    return this._addCheck({ kind: "date", message: e });
  }
  time(e) {
    return typeof e == "string" ? this._addCheck({
      kind: "time",
      precision: null,
      message: e
    }) : this._addCheck({
      kind: "time",
      precision: typeof (e == null ? void 0 : e.precision) > "u" ? null : e == null ? void 0 : e.precision,
      ...O.errorUtil.errToObj(e == null ? void 0 : e.message)
    });
  }
  duration(e) {
    return this._addCheck({ kind: "duration", ...O.errorUtil.errToObj(e) });
  }
  regex(e, r) {
    return this._addCheck({
      kind: "regex",
      regex: e,
      ...O.errorUtil.errToObj(r)
    });
  }
  includes(e, r) {
    return this._addCheck({
      kind: "includes",
      value: e,
      position: r == null ? void 0 : r.position,
      ...O.errorUtil.errToObj(r == null ? void 0 : r.message)
    });
  }
  startsWith(e, r) {
    return this._addCheck({
      kind: "startsWith",
      value: e,
      ...O.errorUtil.errToObj(r)
    });
  }
  endsWith(e, r) {
    return this._addCheck({
      kind: "endsWith",
      value: e,
      ...O.errorUtil.errToObj(r)
    });
  }
  min(e, r) {
    return this._addCheck({
      kind: "min",
      value: e,
      ...O.errorUtil.errToObj(r)
    });
  }
  max(e, r) {
    return this._addCheck({
      kind: "max",
      value: e,
      ...O.errorUtil.errToObj(r)
    });
  }
  length(e, r) {
    return this._addCheck({
      kind: "length",
      value: e,
      ...O.errorUtil.errToObj(r)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(e) {
    return this.min(1, O.errorUtil.errToObj(e));
  }
  trim() {
    return new qe({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new qe({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new qe({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((e) => e.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((e) => e.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((e) => e.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((e) => e.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((e) => e.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((e) => e.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((e) => e.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((e) => e.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((e) => e.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((e) => e.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((e) => e.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((e) => e.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((e) => e.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((e) => e.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((e) => e.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((e) => e.kind === "base64url");
  }
  get minLength() {
    let e = null;
    for (const r of this._def.checks)
      r.kind === "min" && (e === null || r.value > e) && (e = r.value);
    return e;
  }
  get maxLength() {
    let e = null;
    for (const r of this._def.checks)
      r.kind === "max" && (e === null || r.value < e) && (e = r.value);
    return e;
  }
}
y.ZodString = qe;
qe.create = (t) => new qe({
  checks: [],
  typeName: j.ZodString,
  coerce: (t == null ? void 0 : t.coerce) ?? !1,
  ...$(t)
});
function ry(t, e) {
  const r = (t.toString().split(".")[1] || "").length, n = (e.toString().split(".")[1] || "").length, s = r > n ? r : n, a = Number.parseInt(t.toFixed(s).replace(".", "")), o = Number.parseInt(e.toFixed(s).replace(".", ""));
  return a % o / 10 ** s;
}
class zt extends U {
  constructor() {
    super(...arguments), this.min = this.gte, this.max = this.lte, this.step = this.multipleOf;
  }
  _parse(e) {
    if (this._def.coerce && (e.data = Number(e.data)), this._getType(e) !== A.ZodParsedType.number) {
      const a = this._getOrReturnCtx(e);
      return (0, m.addIssueToContext)(a, {
        code: E.ZodIssueCode.invalid_type,
        expected: A.ZodParsedType.number,
        received: a.parsedType
      }), m.INVALID;
    }
    let n;
    const s = new m.ParseStatus();
    for (const a of this._def.checks)
      a.kind === "int" ? A.util.isInteger(e.data) || (n = this._getOrReturnCtx(e, n), (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.invalid_type,
        expected: "integer",
        received: "float",
        message: a.message
      }), s.dirty()) : a.kind === "min" ? (a.inclusive ? e.data < a.value : e.data <= a.value) && (n = this._getOrReturnCtx(e, n), (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.too_small,
        minimum: a.value,
        type: "number",
        inclusive: a.inclusive,
        exact: !1,
        message: a.message
      }), s.dirty()) : a.kind === "max" ? (a.inclusive ? e.data > a.value : e.data >= a.value) && (n = this._getOrReturnCtx(e, n), (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.too_big,
        maximum: a.value,
        type: "number",
        inclusive: a.inclusive,
        exact: !1,
        message: a.message
      }), s.dirty()) : a.kind === "multipleOf" ? ry(e.data, a.value) !== 0 && (n = this._getOrReturnCtx(e, n), (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.not_multiple_of,
        multipleOf: a.value,
        message: a.message
      }), s.dirty()) : a.kind === "finite" ? Number.isFinite(e.data) || (n = this._getOrReturnCtx(e, n), (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.not_finite,
        message: a.message
      }), s.dirty()) : A.util.assertNever(a);
    return { status: s.value, value: e.data };
  }
  gte(e, r) {
    return this.setLimit("min", e, !0, O.errorUtil.toString(r));
  }
  gt(e, r) {
    return this.setLimit("min", e, !1, O.errorUtil.toString(r));
  }
  lte(e, r) {
    return this.setLimit("max", e, !0, O.errorUtil.toString(r));
  }
  lt(e, r) {
    return this.setLimit("max", e, !1, O.errorUtil.toString(r));
  }
  setLimit(e, r, n, s) {
    return new zt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind: e,
          value: r,
          inclusive: n,
          message: O.errorUtil.toString(s)
        }
      ]
    });
  }
  _addCheck(e) {
    return new zt({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  int(e) {
    return this._addCheck({
      kind: "int",
      message: O.errorUtil.toString(e)
    });
  }
  positive(e) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: !1,
      message: O.errorUtil.toString(e)
    });
  }
  negative(e) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: !1,
      message: O.errorUtil.toString(e)
    });
  }
  nonpositive(e) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: !0,
      message: O.errorUtil.toString(e)
    });
  }
  nonnegative(e) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: !0,
      message: O.errorUtil.toString(e)
    });
  }
  multipleOf(e, r) {
    return this._addCheck({
      kind: "multipleOf",
      value: e,
      message: O.errorUtil.toString(r)
    });
  }
  finite(e) {
    return this._addCheck({
      kind: "finite",
      message: O.errorUtil.toString(e)
    });
  }
  safe(e) {
    return this._addCheck({
      kind: "min",
      inclusive: !0,
      value: Number.MIN_SAFE_INTEGER,
      message: O.errorUtil.toString(e)
    })._addCheck({
      kind: "max",
      inclusive: !0,
      value: Number.MAX_SAFE_INTEGER,
      message: O.errorUtil.toString(e)
    });
  }
  get minValue() {
    let e = null;
    for (const r of this._def.checks)
      r.kind === "min" && (e === null || r.value > e) && (e = r.value);
    return e;
  }
  get maxValue() {
    let e = null;
    for (const r of this._def.checks)
      r.kind === "max" && (e === null || r.value < e) && (e = r.value);
    return e;
  }
  get isInt() {
    return !!this._def.checks.find((e) => e.kind === "int" || e.kind === "multipleOf" && A.util.isInteger(e.value));
  }
  get isFinite() {
    let e = null, r = null;
    for (const n of this._def.checks) {
      if (n.kind === "finite" || n.kind === "int" || n.kind === "multipleOf")
        return !0;
      n.kind === "min" ? (r === null || n.value > r) && (r = n.value) : n.kind === "max" && (e === null || n.value < e) && (e = n.value);
    }
    return Number.isFinite(r) && Number.isFinite(e);
  }
}
y.ZodNumber = zt;
zt.create = (t) => new zt({
  checks: [],
  typeName: j.ZodNumber,
  coerce: (t == null ? void 0 : t.coerce) || !1,
  ...$(t)
});
class $t extends U {
  constructor() {
    super(...arguments), this.min = this.gte, this.max = this.lte;
  }
  _parse(e) {
    if (this._def.coerce)
      try {
        e.data = BigInt(e.data);
      } catch {
        return this._getInvalidInput(e);
      }
    if (this._getType(e) !== A.ZodParsedType.bigint)
      return this._getInvalidInput(e);
    let n;
    const s = new m.ParseStatus();
    for (const a of this._def.checks)
      a.kind === "min" ? (a.inclusive ? e.data < a.value : e.data <= a.value) && (n = this._getOrReturnCtx(e, n), (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.too_small,
        type: "bigint",
        minimum: a.value,
        inclusive: a.inclusive,
        message: a.message
      }), s.dirty()) : a.kind === "max" ? (a.inclusive ? e.data > a.value : e.data >= a.value) && (n = this._getOrReturnCtx(e, n), (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.too_big,
        type: "bigint",
        maximum: a.value,
        inclusive: a.inclusive,
        message: a.message
      }), s.dirty()) : a.kind === "multipleOf" ? e.data % a.value !== BigInt(0) && (n = this._getOrReturnCtx(e, n), (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.not_multiple_of,
        multipleOf: a.value,
        message: a.message
      }), s.dirty()) : A.util.assertNever(a);
    return { status: s.value, value: e.data };
  }
  _getInvalidInput(e) {
    const r = this._getOrReturnCtx(e);
    return (0, m.addIssueToContext)(r, {
      code: E.ZodIssueCode.invalid_type,
      expected: A.ZodParsedType.bigint,
      received: r.parsedType
    }), m.INVALID;
  }
  gte(e, r) {
    return this.setLimit("min", e, !0, O.errorUtil.toString(r));
  }
  gt(e, r) {
    return this.setLimit("min", e, !1, O.errorUtil.toString(r));
  }
  lte(e, r) {
    return this.setLimit("max", e, !0, O.errorUtil.toString(r));
  }
  lt(e, r) {
    return this.setLimit("max", e, !1, O.errorUtil.toString(r));
  }
  setLimit(e, r, n, s) {
    return new $t({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind: e,
          value: r,
          inclusive: n,
          message: O.errorUtil.toString(s)
        }
      ]
    });
  }
  _addCheck(e) {
    return new $t({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  positive(e) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: !1,
      message: O.errorUtil.toString(e)
    });
  }
  negative(e) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: !1,
      message: O.errorUtil.toString(e)
    });
  }
  nonpositive(e) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: !0,
      message: O.errorUtil.toString(e)
    });
  }
  nonnegative(e) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: !0,
      message: O.errorUtil.toString(e)
    });
  }
  multipleOf(e, r) {
    return this._addCheck({
      kind: "multipleOf",
      value: e,
      message: O.errorUtil.toString(r)
    });
  }
  get minValue() {
    let e = null;
    for (const r of this._def.checks)
      r.kind === "min" && (e === null || r.value > e) && (e = r.value);
    return e;
  }
  get maxValue() {
    let e = null;
    for (const r of this._def.checks)
      r.kind === "max" && (e === null || r.value < e) && (e = r.value);
    return e;
  }
}
y.ZodBigInt = $t;
$t.create = (t) => new $t({
  checks: [],
  typeName: j.ZodBigInt,
  coerce: (t == null ? void 0 : t.coerce) ?? !1,
  ...$(t)
});
class fn extends U {
  _parse(e) {
    if (this._def.coerce && (e.data = !!e.data), this._getType(e) !== A.ZodParsedType.boolean) {
      const n = this._getOrReturnCtx(e);
      return (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.invalid_type,
        expected: A.ZodParsedType.boolean,
        received: n.parsedType
      }), m.INVALID;
    }
    return (0, m.OK)(e.data);
  }
}
y.ZodBoolean = fn;
fn.create = (t) => new fn({
  typeName: j.ZodBoolean,
  coerce: (t == null ? void 0 : t.coerce) || !1,
  ...$(t)
});
class nr extends U {
  _parse(e) {
    if (this._def.coerce && (e.data = new Date(e.data)), this._getType(e) !== A.ZodParsedType.date) {
      const a = this._getOrReturnCtx(e);
      return (0, m.addIssueToContext)(a, {
        code: E.ZodIssueCode.invalid_type,
        expected: A.ZodParsedType.date,
        received: a.parsedType
      }), m.INVALID;
    }
    if (Number.isNaN(e.data.getTime())) {
      const a = this._getOrReturnCtx(e);
      return (0, m.addIssueToContext)(a, {
        code: E.ZodIssueCode.invalid_date
      }), m.INVALID;
    }
    const n = new m.ParseStatus();
    let s;
    for (const a of this._def.checks)
      a.kind === "min" ? e.data.getTime() < a.value && (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
        code: E.ZodIssueCode.too_small,
        message: a.message,
        inclusive: !0,
        exact: !1,
        minimum: a.value,
        type: "date"
      }), n.dirty()) : a.kind === "max" ? e.data.getTime() > a.value && (s = this._getOrReturnCtx(e, s), (0, m.addIssueToContext)(s, {
        code: E.ZodIssueCode.too_big,
        message: a.message,
        inclusive: !0,
        exact: !1,
        maximum: a.value,
        type: "date"
      }), n.dirty()) : A.util.assertNever(a);
    return {
      status: n.value,
      value: new Date(e.data.getTime())
    };
  }
  _addCheck(e) {
    return new nr({
      ...this._def,
      checks: [...this._def.checks, e]
    });
  }
  min(e, r) {
    return this._addCheck({
      kind: "min",
      value: e.getTime(),
      message: O.errorUtil.toString(r)
    });
  }
  max(e, r) {
    return this._addCheck({
      kind: "max",
      value: e.getTime(),
      message: O.errorUtil.toString(r)
    });
  }
  get minDate() {
    let e = null;
    for (const r of this._def.checks)
      r.kind === "min" && (e === null || r.value > e) && (e = r.value);
    return e != null ? new Date(e) : null;
  }
  get maxDate() {
    let e = null;
    for (const r of this._def.checks)
      r.kind === "max" && (e === null || r.value < e) && (e = r.value);
    return e != null ? new Date(e) : null;
  }
}
y.ZodDate = nr;
nr.create = (t) => new nr({
  checks: [],
  coerce: (t == null ? void 0 : t.coerce) || !1,
  typeName: j.ZodDate,
  ...$(t)
});
class na extends U {
  _parse(e) {
    if (this._getType(e) !== A.ZodParsedType.symbol) {
      const n = this._getOrReturnCtx(e);
      return (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.invalid_type,
        expected: A.ZodParsedType.symbol,
        received: n.parsedType
      }), m.INVALID;
    }
    return (0, m.OK)(e.data);
  }
}
y.ZodSymbol = na;
na.create = (t) => new na({
  typeName: j.ZodSymbol,
  ...$(t)
});
class pn extends U {
  _parse(e) {
    if (this._getType(e) !== A.ZodParsedType.undefined) {
      const n = this._getOrReturnCtx(e);
      return (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.invalid_type,
        expected: A.ZodParsedType.undefined,
        received: n.parsedType
      }), m.INVALID;
    }
    return (0, m.OK)(e.data);
  }
}
y.ZodUndefined = pn;
pn.create = (t) => new pn({
  typeName: j.ZodUndefined,
  ...$(t)
});
class yn extends U {
  _parse(e) {
    if (this._getType(e) !== A.ZodParsedType.null) {
      const n = this._getOrReturnCtx(e);
      return (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.invalid_type,
        expected: A.ZodParsedType.null,
        received: n.parsedType
      }), m.INVALID;
    }
    return (0, m.OK)(e.data);
  }
}
y.ZodNull = yn;
yn.create = (t) => new yn({
  typeName: j.ZodNull,
  ...$(t)
});
class Sr extends U {
  constructor() {
    super(...arguments), this._any = !0;
  }
  _parse(e) {
    return (0, m.OK)(e.data);
  }
}
y.ZodAny = Sr;
Sr.create = (t) => new Sr({
  typeName: j.ZodAny,
  ...$(t)
});
class tr extends U {
  constructor() {
    super(...arguments), this._unknown = !0;
  }
  _parse(e) {
    return (0, m.OK)(e.data);
  }
}
y.ZodUnknown = tr;
tr.create = (t) => new tr({
  typeName: j.ZodUnknown,
  ...$(t)
});
class _t extends U {
  _parse(e) {
    const r = this._getOrReturnCtx(e);
    return (0, m.addIssueToContext)(r, {
      code: E.ZodIssueCode.invalid_type,
      expected: A.ZodParsedType.never,
      received: r.parsedType
    }), m.INVALID;
  }
}
y.ZodNever = _t;
_t.create = (t) => new _t({
  typeName: j.ZodNever,
  ...$(t)
});
class sa extends U {
  _parse(e) {
    if (this._getType(e) !== A.ZodParsedType.undefined) {
      const n = this._getOrReturnCtx(e);
      return (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.invalid_type,
        expected: A.ZodParsedType.void,
        received: n.parsedType
      }), m.INVALID;
    }
    return (0, m.OK)(e.data);
  }
}
y.ZodVoid = sa;
sa.create = (t) => new sa({
  typeName: j.ZodVoid,
  ...$(t)
});
class Ge extends U {
  _parse(e) {
    const { ctx: r, status: n } = this._processInputParams(e), s = this._def;
    if (r.parsedType !== A.ZodParsedType.array)
      return (0, m.addIssueToContext)(r, {
        code: E.ZodIssueCode.invalid_type,
        expected: A.ZodParsedType.array,
        received: r.parsedType
      }), m.INVALID;
    if (s.exactLength !== null) {
      const o = r.data.length > s.exactLength.value, i = r.data.length < s.exactLength.value;
      (o || i) && ((0, m.addIssueToContext)(r, {
        code: o ? E.ZodIssueCode.too_big : E.ZodIssueCode.too_small,
        minimum: i ? s.exactLength.value : void 0,
        maximum: o ? s.exactLength.value : void 0,
        type: "array",
        inclusive: !0,
        exact: !0,
        message: s.exactLength.message
      }), n.dirty());
    }
    if (s.minLength !== null && r.data.length < s.minLength.value && ((0, m.addIssueToContext)(r, {
      code: E.ZodIssueCode.too_small,
      minimum: s.minLength.value,
      type: "array",
      inclusive: !0,
      exact: !1,
      message: s.minLength.message
    }), n.dirty()), s.maxLength !== null && r.data.length > s.maxLength.value && ((0, m.addIssueToContext)(r, {
      code: E.ZodIssueCode.too_big,
      maximum: s.maxLength.value,
      type: "array",
      inclusive: !0,
      exact: !1,
      message: s.maxLength.message
    }), n.dirty()), r.common.async)
      return Promise.all([...r.data].map((o, i) => s.type._parseAsync(new st(r, o, r.path, i)))).then((o) => m.ParseStatus.mergeArray(n, o));
    const a = [...r.data].map((o, i) => s.type._parseSync(new st(r, o, r.path, i)));
    return m.ParseStatus.mergeArray(n, a);
  }
  get element() {
    return this._def.type;
  }
  min(e, r) {
    return new Ge({
      ...this._def,
      minLength: { value: e, message: O.errorUtil.toString(r) }
    });
  }
  max(e, r) {
    return new Ge({
      ...this._def,
      maxLength: { value: e, message: O.errorUtil.toString(r) }
    });
  }
  length(e, r) {
    return new Ge({
      ...this._def,
      exactLength: { value: e, message: O.errorUtil.toString(r) }
    });
  }
  nonempty(e) {
    return this.min(1, e);
  }
}
y.ZodArray = Ge;
Ge.create = (t, e) => new Ge({
  type: t,
  minLength: null,
  maxLength: null,
  exactLength: null,
  typeName: j.ZodArray,
  ...$(e)
});
function hr(t) {
  if (t instanceof q) {
    const e = {};
    for (const r in t.shape) {
      const n = t.shape[r];
      e[r] = nt.create(hr(n));
    }
    return new q({
      ...t._def,
      shape: () => e
    });
  } else return t instanceof Ge ? new Ge({
    ...t._def,
    type: hr(t.element)
  }) : t instanceof nt ? nt.create(hr(t.unwrap())) : t instanceof Ut ? Ut.create(hr(t.unwrap())) : t instanceof at ? at.create(t.items.map((e) => hr(e))) : t;
}
class q extends U {
  constructor() {
    super(...arguments), this._cached = null, this.nonstrict = this.passthrough, this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const e = this._def.shape(), r = A.util.objectKeys(e);
    return this._cached = { shape: e, keys: r }, this._cached;
  }
  _parse(e) {
    if (this._getType(e) !== A.ZodParsedType.object) {
      const d = this._getOrReturnCtx(e);
      return (0, m.addIssueToContext)(d, {
        code: E.ZodIssueCode.invalid_type,
        expected: A.ZodParsedType.object,
        received: d.parsedType
      }), m.INVALID;
    }
    const { status: n, ctx: s } = this._processInputParams(e), { shape: a, keys: o } = this._getCached(), i = [];
    if (!(this._def.catchall instanceof _t && this._def.unknownKeys === "strip"))
      for (const d in s.data)
        o.includes(d) || i.push(d);
    const c = [];
    for (const d of o) {
      const u = a[d], l = s.data[d];
      c.push({
        key: { status: "valid", value: d },
        value: u._parse(new st(s, l, s.path, d)),
        alwaysSet: d in s.data
      });
    }
    if (this._def.catchall instanceof _t) {
      const d = this._def.unknownKeys;
      if (d === "passthrough")
        for (const u of i)
          c.push({
            key: { status: "valid", value: u },
            value: { status: "valid", value: s.data[u] }
          });
      else if (d === "strict")
        i.length > 0 && ((0, m.addIssueToContext)(s, {
          code: E.ZodIssueCode.unrecognized_keys,
          keys: i
        }), n.dirty());
      else if (d !== "strip") throw new Error("Internal ZodObject error: invalid unknownKeys value.");
    } else {
      const d = this._def.catchall;
      for (const u of i) {
        const l = s.data[u];
        c.push({
          key: { status: "valid", value: u },
          value: d._parse(
            new st(s, l, s.path, u)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: u in s.data
        });
      }
    }
    return s.common.async ? Promise.resolve().then(async () => {
      const d = [];
      for (const u of c) {
        const l = await u.key, p = await u.value;
        d.push({
          key: l,
          value: p,
          alwaysSet: u.alwaysSet
        });
      }
      return d;
    }).then((d) => m.ParseStatus.mergeObjectSync(n, d)) : m.ParseStatus.mergeObjectSync(n, c);
  }
  get shape() {
    return this._def.shape();
  }
  strict(e) {
    return O.errorUtil.errToObj, new q({
      ...this._def,
      unknownKeys: "strict",
      ...e !== void 0 ? {
        errorMap: (r, n) => {
          var a, o;
          const s = ((o = (a = this._def).errorMap) == null ? void 0 : o.call(a, r, n).message) ?? n.defaultError;
          return r.code === "unrecognized_keys" ? {
            message: O.errorUtil.errToObj(e).message ?? s
          } : {
            message: s
          };
        }
      } : {}
    });
  }
  strip() {
    return new q({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new q({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(e) {
    return new q({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...e
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(e) {
    return new q({
      unknownKeys: e._def.unknownKeys,
      catchall: e._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...e._def.shape()
      }),
      typeName: j.ZodObject
    });
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(e, r) {
    return this.augment({ [e]: r });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(e) {
    return new q({
      ...this._def,
      catchall: e
    });
  }
  pick(e) {
    const r = {};
    for (const n of A.util.objectKeys(e))
      e[n] && this.shape[n] && (r[n] = this.shape[n]);
    return new q({
      ...this._def,
      shape: () => r
    });
  }
  omit(e) {
    const r = {};
    for (const n of A.util.objectKeys(this.shape))
      e[n] || (r[n] = this.shape[n]);
    return new q({
      ...this._def,
      shape: () => r
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return hr(this);
  }
  partial(e) {
    const r = {};
    for (const n of A.util.objectKeys(this.shape)) {
      const s = this.shape[n];
      e && !e[n] ? r[n] = s : r[n] = s.optional();
    }
    return new q({
      ...this._def,
      shape: () => r
    });
  }
  required(e) {
    const r = {};
    for (const n of A.util.objectKeys(this.shape))
      if (e && !e[n])
        r[n] = this.shape[n];
      else {
        let a = this.shape[n];
        for (; a instanceof nt; )
          a = a._def.innerType;
        r[n] = a;
      }
    return new q({
      ...this._def,
      shape: () => r
    });
  }
  keyof() {
    return hu(A.util.objectKeys(this.shape));
  }
}
y.ZodObject = q;
q.create = (t, e) => new q({
  shape: () => t,
  unknownKeys: "strip",
  catchall: _t.create(),
  typeName: j.ZodObject,
  ...$(e)
});
q.strictCreate = (t, e) => new q({
  shape: () => t,
  unknownKeys: "strict",
  catchall: _t.create(),
  typeName: j.ZodObject,
  ...$(e)
});
q.lazycreate = (t, e) => new q({
  shape: t,
  unknownKeys: "strip",
  catchall: _t.create(),
  typeName: j.ZodObject,
  ...$(e)
});
class mn extends U {
  _parse(e) {
    const { ctx: r } = this._processInputParams(e), n = this._def.options;
    function s(a) {
      for (const i of a)
        if (i.result.status === "valid")
          return i.result;
      for (const i of a)
        if (i.result.status === "dirty")
          return r.common.issues.push(...i.ctx.common.issues), i.result;
      const o = a.map((i) => new E.ZodError(i.ctx.common.issues));
      return (0, m.addIssueToContext)(r, {
        code: E.ZodIssueCode.invalid_union,
        unionErrors: o
      }), m.INVALID;
    }
    if (r.common.async)
      return Promise.all(n.map(async (a) => {
        const o = {
          ...r,
          common: {
            ...r.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await a._parseAsync({
            data: r.data,
            path: r.path,
            parent: o
          }),
          ctx: o
        };
      })).then(s);
    {
      let a;
      const o = [];
      for (const c of n) {
        const d = {
          ...r,
          common: {
            ...r.common,
            issues: []
          },
          parent: null
        }, u = c._parseSync({
          data: r.data,
          path: r.path,
          parent: d
        });
        if (u.status === "valid")
          return u;
        u.status === "dirty" && !a && (a = { result: u, ctx: d }), d.common.issues.length && o.push(d.common.issues);
      }
      if (a)
        return r.common.issues.push(...a.ctx.common.issues), a.result;
      const i = o.map((c) => new E.ZodError(c));
      return (0, m.addIssueToContext)(r, {
        code: E.ZodIssueCode.invalid_union,
        unionErrors: i
      }), m.INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
}
y.ZodUnion = mn;
mn.create = (t, e) => new mn({
  options: t,
  typeName: j.ZodUnion,
  ...$(e)
});
const ht = (t) => t instanceof wn ? ht(t.schema) : t instanceof Ye ? ht(t.innerType()) : t instanceof vn ? [t.value] : t instanceof Mt ? t.options : t instanceof bn ? A.util.objectValues(t.enum) : t instanceof Sn ? ht(t._def.innerType) : t instanceof pn ? [void 0] : t instanceof yn ? [null] : t instanceof nt ? [void 0, ...ht(t.unwrap())] : t instanceof Ut ? [null, ...ht(t.unwrap())] : t instanceof Ni || t instanceof An ? ht(t.unwrap()) : t instanceof En ? ht(t._def.innerType) : [];
class Oa extends U {
  _parse(e) {
    const { ctx: r } = this._processInputParams(e);
    if (r.parsedType !== A.ZodParsedType.object)
      return (0, m.addIssueToContext)(r, {
        code: E.ZodIssueCode.invalid_type,
        expected: A.ZodParsedType.object,
        received: r.parsedType
      }), m.INVALID;
    const n = this.discriminator, s = r.data[n], a = this.optionsMap.get(s);
    return a ? r.common.async ? a._parseAsync({
      data: r.data,
      path: r.path,
      parent: r
    }) : a._parseSync({
      data: r.data,
      path: r.path,
      parent: r
    }) : ((0, m.addIssueToContext)(r, {
      code: E.ZodIssueCode.invalid_union_discriminator,
      options: Array.from(this.optionsMap.keys()),
      path: [n]
    }), m.INVALID);
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(e, r, n) {
    const s = /* @__PURE__ */ new Map();
    for (const a of r) {
      const o = ht(a.shape[e]);
      if (!o.length)
        throw new Error(`A discriminator value for key \`${e}\` could not be extracted from all schema options`);
      for (const i of o) {
        if (s.has(i))
          throw new Error(`Discriminator property ${String(e)} has duplicate value ${String(i)}`);
        s.set(i, a);
      }
    }
    return new Oa({
      typeName: j.ZodDiscriminatedUnion,
      discriminator: e,
      options: r,
      optionsMap: s,
      ...$(n)
    });
  }
}
y.ZodDiscriminatedUnion = Oa;
function yi(t, e) {
  const r = (0, A.getParsedType)(t), n = (0, A.getParsedType)(e);
  if (t === e)
    return { valid: !0, data: t };
  if (r === A.ZodParsedType.object && n === A.ZodParsedType.object) {
    const s = A.util.objectKeys(e), a = A.util.objectKeys(t).filter((i) => s.indexOf(i) !== -1), o = { ...t, ...e };
    for (const i of a) {
      const c = yi(t[i], e[i]);
      if (!c.valid)
        return { valid: !1 };
      o[i] = c.data;
    }
    return { valid: !0, data: o };
  } else if (r === A.ZodParsedType.array && n === A.ZodParsedType.array) {
    if (t.length !== e.length)
      return { valid: !1 };
    const s = [];
    for (let a = 0; a < t.length; a++) {
      const o = t[a], i = e[a], c = yi(o, i);
      if (!c.valid)
        return { valid: !1 };
      s.push(c.data);
    }
    return { valid: !0, data: s };
  } else return r === A.ZodParsedType.date && n === A.ZodParsedType.date && +t == +e ? { valid: !0, data: t } : { valid: !1 };
}
class _n extends U {
  _parse(e) {
    const { status: r, ctx: n } = this._processInputParams(e), s = (a, o) => {
      if ((0, m.isAborted)(a) || (0, m.isAborted)(o))
        return m.INVALID;
      const i = yi(a.value, o.value);
      return i.valid ? (((0, m.isDirty)(a) || (0, m.isDirty)(o)) && r.dirty(), { status: r.value, value: i.data }) : ((0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.invalid_intersection_types
      }), m.INVALID);
    };
    return n.common.async ? Promise.all([
      this._def.left._parseAsync({
        data: n.data,
        path: n.path,
        parent: n
      }),
      this._def.right._parseAsync({
        data: n.data,
        path: n.path,
        parent: n
      })
    ]).then(([a, o]) => s(a, o)) : s(this._def.left._parseSync({
      data: n.data,
      path: n.path,
      parent: n
    }), this._def.right._parseSync({
      data: n.data,
      path: n.path,
      parent: n
    }));
  }
}
y.ZodIntersection = _n;
_n.create = (t, e, r) => new _n({
  left: t,
  right: e,
  typeName: j.ZodIntersection,
  ...$(r)
});
class at extends U {
  _parse(e) {
    const { status: r, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== A.ZodParsedType.array)
      return (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.invalid_type,
        expected: A.ZodParsedType.array,
        received: n.parsedType
      }), m.INVALID;
    if (n.data.length < this._def.items.length)
      return (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: !0,
        exact: !1,
        type: "array"
      }), m.INVALID;
    !this._def.rest && n.data.length > this._def.items.length && ((0, m.addIssueToContext)(n, {
      code: E.ZodIssueCode.too_big,
      maximum: this._def.items.length,
      inclusive: !0,
      exact: !1,
      type: "array"
    }), r.dirty());
    const a = [...n.data].map((o, i) => {
      const c = this._def.items[i] || this._def.rest;
      return c ? c._parse(new st(n, o, n.path, i)) : null;
    }).filter((o) => !!o);
    return n.common.async ? Promise.all(a).then((o) => m.ParseStatus.mergeArray(r, o)) : m.ParseStatus.mergeArray(r, a);
  }
  get items() {
    return this._def.items;
  }
  rest(e) {
    return new at({
      ...this._def,
      rest: e
    });
  }
}
y.ZodTuple = at;
at.create = (t, e) => {
  if (!Array.isArray(t))
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  return new at({
    items: t,
    typeName: j.ZodTuple,
    rest: null,
    ...$(e)
  });
};
class gn extends U {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(e) {
    const { status: r, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== A.ZodParsedType.object)
      return (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.invalid_type,
        expected: A.ZodParsedType.object,
        received: n.parsedType
      }), m.INVALID;
    const s = [], a = this._def.keyType, o = this._def.valueType;
    for (const i in n.data)
      s.push({
        key: a._parse(new st(n, i, n.path, i)),
        value: o._parse(new st(n, n.data[i], n.path, i)),
        alwaysSet: i in n.data
      });
    return n.common.async ? m.ParseStatus.mergeObjectAsync(r, s) : m.ParseStatus.mergeObjectSync(r, s);
  }
  get element() {
    return this._def.valueType;
  }
  static create(e, r, n) {
    return r instanceof U ? new gn({
      keyType: e,
      valueType: r,
      typeName: j.ZodRecord,
      ...$(n)
    }) : new gn({
      keyType: qe.create(),
      valueType: e,
      typeName: j.ZodRecord,
      ...$(r)
    });
  }
}
y.ZodRecord = gn;
class aa extends U {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(e) {
    const { status: r, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== A.ZodParsedType.map)
      return (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.invalid_type,
        expected: A.ZodParsedType.map,
        received: n.parsedType
      }), m.INVALID;
    const s = this._def.keyType, a = this._def.valueType, o = [...n.data.entries()].map(([i, c], d) => ({
      key: s._parse(new st(n, i, n.path, [d, "key"])),
      value: a._parse(new st(n, c, n.path, [d, "value"]))
    }));
    if (n.common.async) {
      const i = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const c of o) {
          const d = await c.key, u = await c.value;
          if (d.status === "aborted" || u.status === "aborted")
            return m.INVALID;
          (d.status === "dirty" || u.status === "dirty") && r.dirty(), i.set(d.value, u.value);
        }
        return { status: r.value, value: i };
      });
    } else {
      const i = /* @__PURE__ */ new Map();
      for (const c of o) {
        const d = c.key, u = c.value;
        if (d.status === "aborted" || u.status === "aborted")
          return m.INVALID;
        (d.status === "dirty" || u.status === "dirty") && r.dirty(), i.set(d.value, u.value);
      }
      return { status: r.value, value: i };
    }
  }
}
y.ZodMap = aa;
aa.create = (t, e, r) => new aa({
  valueType: e,
  keyType: t,
  typeName: j.ZodMap,
  ...$(r)
});
class sr extends U {
  _parse(e) {
    const { status: r, ctx: n } = this._processInputParams(e);
    if (n.parsedType !== A.ZodParsedType.set)
      return (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.invalid_type,
        expected: A.ZodParsedType.set,
        received: n.parsedType
      }), m.INVALID;
    const s = this._def;
    s.minSize !== null && n.data.size < s.minSize.value && ((0, m.addIssueToContext)(n, {
      code: E.ZodIssueCode.too_small,
      minimum: s.minSize.value,
      type: "set",
      inclusive: !0,
      exact: !1,
      message: s.minSize.message
    }), r.dirty()), s.maxSize !== null && n.data.size > s.maxSize.value && ((0, m.addIssueToContext)(n, {
      code: E.ZodIssueCode.too_big,
      maximum: s.maxSize.value,
      type: "set",
      inclusive: !0,
      exact: !1,
      message: s.maxSize.message
    }), r.dirty());
    const a = this._def.valueType;
    function o(c) {
      const d = /* @__PURE__ */ new Set();
      for (const u of c) {
        if (u.status === "aborted")
          return m.INVALID;
        u.status === "dirty" && r.dirty(), d.add(u.value);
      }
      return { status: r.value, value: d };
    }
    const i = [...n.data.values()].map((c, d) => a._parse(new st(n, c, n.path, d)));
    return n.common.async ? Promise.all(i).then((c) => o(c)) : o(i);
  }
  min(e, r) {
    return new sr({
      ...this._def,
      minSize: { value: e, message: O.errorUtil.toString(r) }
    });
  }
  max(e, r) {
    return new sr({
      ...this._def,
      maxSize: { value: e, message: O.errorUtil.toString(r) }
    });
  }
  size(e, r) {
    return this.min(e, r).max(e, r);
  }
  nonempty(e) {
    return this.min(1, e);
  }
}
y.ZodSet = sr;
sr.create = (t, e) => new sr({
  valueType: t,
  minSize: null,
  maxSize: null,
  typeName: j.ZodSet,
  ...$(e)
});
class mr extends U {
  constructor() {
    super(...arguments), this.validate = this.implement;
  }
  _parse(e) {
    const { ctx: r } = this._processInputParams(e);
    if (r.parsedType !== A.ZodParsedType.function)
      return (0, m.addIssueToContext)(r, {
        code: E.ZodIssueCode.invalid_type,
        expected: A.ZodParsedType.function,
        received: r.parsedType
      }), m.INVALID;
    function n(i, c) {
      return (0, m.makeIssue)({
        data: i,
        path: r.path,
        errorMaps: [r.common.contextualErrorMap, r.schemaErrorMap, (0, js.getErrorMap)(), js.defaultErrorMap].filter((d) => !!d),
        issueData: {
          code: E.ZodIssueCode.invalid_arguments,
          argumentsError: c
        }
      });
    }
    function s(i, c) {
      return (0, m.makeIssue)({
        data: i,
        path: r.path,
        errorMaps: [r.common.contextualErrorMap, r.schemaErrorMap, (0, js.getErrorMap)(), js.defaultErrorMap].filter((d) => !!d),
        issueData: {
          code: E.ZodIssueCode.invalid_return_type,
          returnTypeError: c
        }
      });
    }
    const a = { errorMap: r.common.contextualErrorMap }, o = r.data;
    if (this._def.returns instanceof Er) {
      const i = this;
      return (0, m.OK)(async function(...c) {
        const d = new E.ZodError([]), u = await i._def.args.parseAsync(c, a).catch((f) => {
          throw d.addIssue(n(c, f)), d;
        }), l = await Reflect.apply(o, this, u);
        return await i._def.returns._def.type.parseAsync(l, a).catch((f) => {
          throw d.addIssue(s(l, f)), d;
        });
      });
    } else {
      const i = this;
      return (0, m.OK)(function(...c) {
        const d = i._def.args.safeParse(c, a);
        if (!d.success)
          throw new E.ZodError([n(c, d.error)]);
        const u = Reflect.apply(o, this, d.data), l = i._def.returns.safeParse(u, a);
        if (!l.success)
          throw new E.ZodError([s(u, l.error)]);
        return l.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...e) {
    return new mr({
      ...this._def,
      args: at.create(e).rest(tr.create())
    });
  }
  returns(e) {
    return new mr({
      ...this._def,
      returns: e
    });
  }
  implement(e) {
    return this.parse(e);
  }
  strictImplement(e) {
    return this.parse(e);
  }
  static create(e, r, n) {
    return new mr({
      args: e || at.create([]).rest(tr.create()),
      returns: r || tr.create(),
      typeName: j.ZodFunction,
      ...$(n)
    });
  }
}
y.ZodFunction = mr;
class wn extends U {
  get schema() {
    return this._def.getter();
  }
  _parse(e) {
    const { ctx: r } = this._processInputParams(e);
    return this._def.getter()._parse({ data: r.data, path: r.path, parent: r });
  }
}
y.ZodLazy = wn;
wn.create = (t, e) => new wn({
  getter: t,
  typeName: j.ZodLazy,
  ...$(e)
});
class vn extends U {
  _parse(e) {
    if (e.data !== this._def.value) {
      const r = this._getOrReturnCtx(e);
      return (0, m.addIssueToContext)(r, {
        received: r.data,
        code: E.ZodIssueCode.invalid_literal,
        expected: this._def.value
      }), m.INVALID;
    }
    return { status: "valid", value: e.data };
  }
  get value() {
    return this._def.value;
  }
}
y.ZodLiteral = vn;
vn.create = (t, e) => new vn({
  value: t,
  typeName: j.ZodLiteral,
  ...$(e)
});
function hu(t, e) {
  return new Mt({
    values: t,
    typeName: j.ZodEnum,
    ...$(e)
  });
}
class Mt extends U {
  _parse(e) {
    if (typeof e.data != "string") {
      const r = this._getOrReturnCtx(e), n = this._def.values;
      return (0, m.addIssueToContext)(r, {
        expected: A.util.joinValues(n),
        received: r.parsedType,
        code: E.ZodIssueCode.invalid_type
      }), m.INVALID;
    }
    if (this._cache || (this._cache = new Set(this._def.values)), !this._cache.has(e.data)) {
      const r = this._getOrReturnCtx(e), n = this._def.values;
      return (0, m.addIssueToContext)(r, {
        received: r.data,
        code: E.ZodIssueCode.invalid_enum_value,
        options: n
      }), m.INVALID;
    }
    return (0, m.OK)(e.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const e = {};
    for (const r of this._def.values)
      e[r] = r;
    return e;
  }
  get Values() {
    const e = {};
    for (const r of this._def.values)
      e[r] = r;
    return e;
  }
  get Enum() {
    const e = {};
    for (const r of this._def.values)
      e[r] = r;
    return e;
  }
  extract(e, r = this._def) {
    return Mt.create(e, {
      ...this._def,
      ...r
    });
  }
  exclude(e, r = this._def) {
    return Mt.create(this.options.filter((n) => !e.includes(n)), {
      ...this._def,
      ...r
    });
  }
}
y.ZodEnum = Mt;
Mt.create = hu;
class bn extends U {
  _parse(e) {
    const r = A.util.getValidEnumValues(this._def.values), n = this._getOrReturnCtx(e);
    if (n.parsedType !== A.ZodParsedType.string && n.parsedType !== A.ZodParsedType.number) {
      const s = A.util.objectValues(r);
      return (0, m.addIssueToContext)(n, {
        expected: A.util.joinValues(s),
        received: n.parsedType,
        code: E.ZodIssueCode.invalid_type
      }), m.INVALID;
    }
    if (this._cache || (this._cache = new Set(A.util.getValidEnumValues(this._def.values))), !this._cache.has(e.data)) {
      const s = A.util.objectValues(r);
      return (0, m.addIssueToContext)(n, {
        received: n.data,
        code: E.ZodIssueCode.invalid_enum_value,
        options: s
      }), m.INVALID;
    }
    return (0, m.OK)(e.data);
  }
  get enum() {
    return this._def.values;
  }
}
y.ZodNativeEnum = bn;
bn.create = (t, e) => new bn({
  values: t,
  typeName: j.ZodNativeEnum,
  ...$(e)
});
class Er extends U {
  unwrap() {
    return this._def.type;
  }
  _parse(e) {
    const { ctx: r } = this._processInputParams(e);
    if (r.parsedType !== A.ZodParsedType.promise && r.common.async === !1)
      return (0, m.addIssueToContext)(r, {
        code: E.ZodIssueCode.invalid_type,
        expected: A.ZodParsedType.promise,
        received: r.parsedType
      }), m.INVALID;
    const n = r.parsedType === A.ZodParsedType.promise ? r.data : Promise.resolve(r.data);
    return (0, m.OK)(n.then((s) => this._def.type.parseAsync(s, {
      path: r.path,
      errorMap: r.common.contextualErrorMap
    })));
  }
}
y.ZodPromise = Er;
Er.create = (t, e) => new Er({
  type: t,
  typeName: j.ZodPromise,
  ...$(e)
});
class Ye extends U {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === j.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(e) {
    const { status: r, ctx: n } = this._processInputParams(e), s = this._def.effect || null, a = {
      addIssue: (o) => {
        (0, m.addIssueToContext)(n, o), o.fatal ? r.abort() : r.dirty();
      },
      get path() {
        return n.path;
      }
    };
    if (a.addIssue = a.addIssue.bind(a), s.type === "preprocess") {
      const o = s.transform(n.data, a);
      if (n.common.async)
        return Promise.resolve(o).then(async (i) => {
          if (r.value === "aborted")
            return m.INVALID;
          const c = await this._def.schema._parseAsync({
            data: i,
            path: n.path,
            parent: n
          });
          return c.status === "aborted" ? m.INVALID : c.status === "dirty" || r.value === "dirty" ? (0, m.DIRTY)(c.value) : c;
        });
      {
        if (r.value === "aborted")
          return m.INVALID;
        const i = this._def.schema._parseSync({
          data: o,
          path: n.path,
          parent: n
        });
        return i.status === "aborted" ? m.INVALID : i.status === "dirty" || r.value === "dirty" ? (0, m.DIRTY)(i.value) : i;
      }
    }
    if (s.type === "refinement") {
      const o = (i) => {
        const c = s.refinement(i, a);
        if (n.common.async)
          return Promise.resolve(c);
        if (c instanceof Promise)
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        return i;
      };
      if (n.common.async === !1) {
        const i = this._def.schema._parseSync({
          data: n.data,
          path: n.path,
          parent: n
        });
        return i.status === "aborted" ? m.INVALID : (i.status === "dirty" && r.dirty(), o(i.value), { status: r.value, value: i.value });
      } else
        return this._def.schema._parseAsync({ data: n.data, path: n.path, parent: n }).then((i) => i.status === "aborted" ? m.INVALID : (i.status === "dirty" && r.dirty(), o(i.value).then(() => ({ status: r.value, value: i.value }))));
    }
    if (s.type === "transform")
      if (n.common.async === !1) {
        const o = this._def.schema._parseSync({
          data: n.data,
          path: n.path,
          parent: n
        });
        if (!(0, m.isValid)(o))
          return m.INVALID;
        const i = s.transform(o.value, a);
        if (i instanceof Promise)
          throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");
        return { status: r.value, value: i };
      } else
        return this._def.schema._parseAsync({ data: n.data, path: n.path, parent: n }).then((o) => (0, m.isValid)(o) ? Promise.resolve(s.transform(o.value, a)).then((i) => ({
          status: r.value,
          value: i
        })) : m.INVALID);
    A.util.assertNever(s);
  }
}
y.ZodEffects = Ye;
y.ZodTransformer = Ye;
Ye.create = (t, e, r) => new Ye({
  schema: t,
  typeName: j.ZodEffects,
  effect: e,
  ...$(r)
});
Ye.createWithPreprocess = (t, e, r) => new Ye({
  schema: e,
  effect: { type: "preprocess", transform: t },
  typeName: j.ZodEffects,
  ...$(r)
});
class nt extends U {
  _parse(e) {
    return this._getType(e) === A.ZodParsedType.undefined ? (0, m.OK)(void 0) : this._def.innerType._parse(e);
  }
  unwrap() {
    return this._def.innerType;
  }
}
y.ZodOptional = nt;
nt.create = (t, e) => new nt({
  innerType: t,
  typeName: j.ZodOptional,
  ...$(e)
});
class Ut extends U {
  _parse(e) {
    return this._getType(e) === A.ZodParsedType.null ? (0, m.OK)(null) : this._def.innerType._parse(e);
  }
  unwrap() {
    return this._def.innerType;
  }
}
y.ZodNullable = Ut;
Ut.create = (t, e) => new Ut({
  innerType: t,
  typeName: j.ZodNullable,
  ...$(e)
});
class Sn extends U {
  _parse(e) {
    const { ctx: r } = this._processInputParams(e);
    let n = r.data;
    return r.parsedType === A.ZodParsedType.undefined && (n = this._def.defaultValue()), this._def.innerType._parse({
      data: n,
      path: r.path,
      parent: r
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
y.ZodDefault = Sn;
Sn.create = (t, e) => new Sn({
  innerType: t,
  typeName: j.ZodDefault,
  defaultValue: typeof e.default == "function" ? e.default : () => e.default,
  ...$(e)
});
class En extends U {
  _parse(e) {
    const { ctx: r } = this._processInputParams(e), n = {
      ...r,
      common: {
        ...r.common,
        issues: []
      }
    }, s = this._def.innerType._parse({
      data: n.data,
      path: n.path,
      parent: {
        ...n
      }
    });
    return (0, m.isAsync)(s) ? s.then((a) => ({
      status: "valid",
      value: a.status === "valid" ? a.value : this._def.catchValue({
        get error() {
          return new E.ZodError(n.common.issues);
        },
        input: n.data
      })
    })) : {
      status: "valid",
      value: s.status === "valid" ? s.value : this._def.catchValue({
        get error() {
          return new E.ZodError(n.common.issues);
        },
        input: n.data
      })
    };
  }
  removeCatch() {
    return this._def.innerType;
  }
}
y.ZodCatch = En;
En.create = (t, e) => new En({
  innerType: t,
  typeName: j.ZodCatch,
  catchValue: typeof e.catch == "function" ? e.catch : () => e.catch,
  ...$(e)
});
class oa extends U {
  _parse(e) {
    if (this._getType(e) !== A.ZodParsedType.nan) {
      const n = this._getOrReturnCtx(e);
      return (0, m.addIssueToContext)(n, {
        code: E.ZodIssueCode.invalid_type,
        expected: A.ZodParsedType.nan,
        received: n.parsedType
      }), m.INVALID;
    }
    return { status: "valid", value: e.data };
  }
}
y.ZodNaN = oa;
oa.create = (t) => new oa({
  typeName: j.ZodNaN,
  ...$(t)
});
y.BRAND = Symbol("zod_brand");
class Ni extends U {
  _parse(e) {
    const { ctx: r } = this._processInputParams(e), n = r.data;
    return this._def.type._parse({
      data: n,
      path: r.path,
      parent: r
    });
  }
  unwrap() {
    return this._def.type;
  }
}
y.ZodBranded = Ni;
class jn extends U {
  _parse(e) {
    const { status: r, ctx: n } = this._processInputParams(e);
    if (n.common.async)
      return (async () => {
        const a = await this._def.in._parseAsync({
          data: n.data,
          path: n.path,
          parent: n
        });
        return a.status === "aborted" ? m.INVALID : a.status === "dirty" ? (r.dirty(), (0, m.DIRTY)(a.value)) : this._def.out._parseAsync({
          data: a.value,
          path: n.path,
          parent: n
        });
      })();
    {
      const s = this._def.in._parseSync({
        data: n.data,
        path: n.path,
        parent: n
      });
      return s.status === "aborted" ? m.INVALID : s.status === "dirty" ? (r.dirty(), {
        status: "dirty",
        value: s.value
      }) : this._def.out._parseSync({
        data: s.value,
        path: n.path,
        parent: n
      });
    }
  }
  static create(e, r) {
    return new jn({
      in: e,
      out: r,
      typeName: j.ZodPipeline
    });
  }
}
y.ZodPipeline = jn;
class An extends U {
  _parse(e) {
    const r = this._def.innerType._parse(e), n = (s) => ((0, m.isValid)(s) && (s.value = Object.freeze(s.value)), s);
    return (0, m.isAsync)(r) ? r.then((s) => n(s)) : n(r);
  }
  unwrap() {
    return this._def.innerType;
  }
}
y.ZodReadonly = An;
An.create = (t, e) => new An({
  innerType: t,
  typeName: j.ZodReadonly,
  ...$(e)
});
function Hc(t, e) {
  const r = typeof t == "function" ? t(e) : typeof t == "string" ? { message: t } : t;
  return typeof r == "string" ? { message: r } : r;
}
function fu(t, e = {}, r) {
  return t ? Sr.create().superRefine((n, s) => {
    const a = t(n);
    if (a instanceof Promise)
      return a.then((o) => {
        if (!o) {
          const i = Hc(e, n), c = i.fatal ?? r ?? !0;
          s.addIssue({ code: "custom", ...i, fatal: c });
        }
      });
    if (!a) {
      const o = Hc(e, n), i = o.fatal ?? r ?? !0;
      s.addIssue({ code: "custom", ...o, fatal: i });
    }
  }) : Sr.create();
}
y.late = {
  object: q.lazycreate
};
var j;
(function(t) {
  t.ZodString = "ZodString", t.ZodNumber = "ZodNumber", t.ZodNaN = "ZodNaN", t.ZodBigInt = "ZodBigInt", t.ZodBoolean = "ZodBoolean", t.ZodDate = "ZodDate", t.ZodSymbol = "ZodSymbol", t.ZodUndefined = "ZodUndefined", t.ZodNull = "ZodNull", t.ZodAny = "ZodAny", t.ZodUnknown = "ZodUnknown", t.ZodNever = "ZodNever", t.ZodVoid = "ZodVoid", t.ZodArray = "ZodArray", t.ZodObject = "ZodObject", t.ZodUnion = "ZodUnion", t.ZodDiscriminatedUnion = "ZodDiscriminatedUnion", t.ZodIntersection = "ZodIntersection", t.ZodTuple = "ZodTuple", t.ZodRecord = "ZodRecord", t.ZodMap = "ZodMap", t.ZodSet = "ZodSet", t.ZodFunction = "ZodFunction", t.ZodLazy = "ZodLazy", t.ZodLiteral = "ZodLiteral", t.ZodEnum = "ZodEnum", t.ZodEffects = "ZodEffects", t.ZodNativeEnum = "ZodNativeEnum", t.ZodOptional = "ZodOptional", t.ZodNullable = "ZodNullable", t.ZodDefault = "ZodDefault", t.ZodCatch = "ZodCatch", t.ZodPromise = "ZodPromise", t.ZodBranded = "ZodBranded", t.ZodPipeline = "ZodPipeline", t.ZodReadonly = "ZodReadonly";
})(j || (y.ZodFirstPartyTypeKind = j = {}));
const ny = (t, e = {
  message: `Input not instance of ${t.name}`
}) => fu((r) => r instanceof t, e);
y.instanceof = ny;
const pu = qe.create;
y.string = pu;
const yu = zt.create;
y.number = yu;
const sy = oa.create;
y.nan = sy;
const ay = $t.create;
y.bigint = ay;
const mu = fn.create;
y.boolean = mu;
const oy = nr.create;
y.date = oy;
const iy = na.create;
y.symbol = iy;
const cy = pn.create;
y.undefined = cy;
const dy = yn.create;
y.null = dy;
const uy = Sr.create;
y.any = uy;
const ly = tr.create;
y.unknown = ly;
const hy = _t.create;
y.never = hy;
const fy = sa.create;
y.void = fy;
const py = Ge.create;
y.array = py;
const yy = q.create;
y.object = yy;
const my = q.strictCreate;
y.strictObject = my;
const _y = mn.create;
y.union = _y;
const gy = Oa.create;
y.discriminatedUnion = gy;
const wy = _n.create;
y.intersection = wy;
const vy = at.create;
y.tuple = vy;
const by = gn.create;
y.record = by;
const Sy = aa.create;
y.map = Sy;
const Ey = sr.create;
y.set = Ey;
const Ay = mr.create;
y.function = Ay;
const Py = wn.create;
y.lazy = Py;
const Iy = vn.create;
y.literal = Iy;
const Cy = Mt.create;
y.enum = Cy;
const Oy = bn.create;
y.nativeEnum = Oy;
const Ty = Er.create;
y.promise = Ty;
const _u = Ye.create;
y.effect = _u;
y.transformer = _u;
const Ry = nt.create;
y.optional = Ry;
const ky = Ut.create;
y.nullable = ky;
const jy = Ye.createWithPreprocess;
y.preprocess = jy;
const Dy = jn.create;
y.pipeline = Dy;
const zy = () => pu().optional();
y.ostring = zy;
const $y = () => yu().optional();
y.onumber = $y;
const My = () => mu().optional();
y.oboolean = My;
y.coerce = {
  string: (t) => qe.create({ ...t, coerce: !0 }),
  number: (t) => zt.create({ ...t, coerce: !0 }),
  boolean: (t) => fn.create({
    ...t,
    coerce: !0
  }),
  bigint: (t) => $t.create({ ...t, coerce: !0 }),
  date: (t) => nr.create({ ...t, coerce: !0 })
};
y.NEVER = m.INVALID;
(function(t) {
  var e = v && v.__createBinding || (Object.create ? function(n, s, a, o) {
    o === void 0 && (o = a);
    var i = Object.getOwnPropertyDescriptor(s, a);
    (!i || ("get" in i ? !s.__esModule : i.writable || i.configurable)) && (i = { enumerable: !0, get: function() {
      return s[a];
    } }), Object.defineProperty(n, o, i);
  } : function(n, s, a, o) {
    o === void 0 && (o = a), n[o] = s[a];
  }), r = v && v.__exportStar || function(n, s) {
    for (var a in n) a !== "default" && !Object.prototype.hasOwnProperty.call(s, a) && e(s, n, a);
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), r(xt, t), r(Li, t), r(cu, t), r(kn, t), r(y, t), r(rt, t);
})(pi);
(function(t) {
  var e = v && v.__createBinding || (Object.create ? function(o, i, c, d) {
    d === void 0 && (d = c);
    var u = Object.getOwnPropertyDescriptor(i, c);
    (!u || ("get" in u ? !i.__esModule : u.writable || u.configurable)) && (u = { enumerable: !0, get: function() {
      return i[c];
    } }), Object.defineProperty(o, d, u);
  } : function(o, i, c, d) {
    d === void 0 && (d = c), o[d] = i[c];
  }), r = v && v.__setModuleDefault || (Object.create ? function(o, i) {
    Object.defineProperty(o, "default", { enumerable: !0, value: i });
  } : function(o, i) {
    o.default = i;
  }), n = v && v.__importStar || function(o) {
    if (o && o.__esModule) return o;
    var i = {};
    if (o != null) for (var c in o) c !== "default" && Object.prototype.hasOwnProperty.call(o, c) && e(i, o, c);
    return r(i, o), i;
  }, s = v && v.__exportStar || function(o, i) {
    for (var c in o) c !== "default" && !Object.prototype.hasOwnProperty.call(i, c) && e(i, o, c);
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), t.z = void 0;
  const a = n(pi);
  t.z = a, s(pi, t), t.default = a;
})(R);
var Ta = {}, Dn = {};
(function(t) {
  Object.defineProperty(t, "__esModule", { value: !0 }), t.JwtVerifyError = t.JwtCreateError = t.JwkError = t.ERR_JWT_VERIFY = t.ERR_JWT_CREATE = t.ERR_JWT_INVALID = t.ERR_JWK_NOT_FOUND = t.ERR_JWK_INVALID = t.ERR_JWKS_NO_MATCHING_KEY = void 0, t.ERR_JWKS_NO_MATCHING_KEY = "ERR_JWKS_NO_MATCHING_KEY", t.ERR_JWK_INVALID = "ERR_JWK_INVALID", t.ERR_JWK_NOT_FOUND = "ERR_JWK_NOT_FOUND", t.ERR_JWT_INVALID = "ERR_JWT_INVALID", t.ERR_JWT_CREATE = "ERR_JWT_CREATE", t.ERR_JWT_VERIFY = "ERR_JWT_VERIFY";
  class e extends TypeError {
    constructor(a = "JWK error", o = t.ERR_JWK_INVALID, i) {
      super(a, i), Object.defineProperty(this, "code", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: o
      });
    }
  }
  t.JwkError = e;
  class r extends Error {
    constructor(a = "Unable to create JWT", o = t.ERR_JWT_CREATE, i) {
      super(a, i), Object.defineProperty(this, "code", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: o
      });
    }
    static from(a, o, i) {
      return a instanceof r ? a : a instanceof e ? new r(i, a.code, { cause: a }) : new r(i, o, { cause: a });
    }
  }
  t.JwtCreateError = r;
  class n extends Error {
    constructor(a = "Invalid JWT", o = t.ERR_JWT_VERIFY, i) {
      super(a, i), Object.defineProperty(this, "code", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: o
      });
    }
    static from(a, o, i) {
      return a instanceof n ? a : a instanceof e ? new n(i, a.code, { cause: a }) : new n(i, o, { cause: a });
    }
  }
  t.JwtVerifyError = n;
})(Dn);
var Cr = {}, ce = {};
class Uy {
  constructor(e, r, n) {
    this.name = e, this.prefix = r, this.baseEncode = n;
  }
  encode(e) {
    if (e instanceof Uint8Array)
      return `${this.prefix}${this.baseEncode(e)}`;
    throw Error("Unknown type, must be binary type");
  }
}
class Ky {
  constructor(e, r, n) {
    if (this.name = e, this.prefix = r, r.codePointAt(0) === void 0)
      throw new Error("Invalid prefix character");
    this.prefixCodePoint = r.codePointAt(0), this.baseDecode = n;
  }
  decode(e) {
    if (typeof e == "string") {
      if (e.codePointAt(0) !== this.prefixCodePoint)
        throw Error(`Unable to decode multibase string ${JSON.stringify(e)}, ${this.name} decoder only supports inputs prefixed with ${this.prefix}`);
      return this.baseDecode(e.slice(this.prefix.length));
    } else
      throw Error("Can only multibase decode strings");
  }
  or(e) {
    return gu(this, e);
  }
}
class xy {
  constructor(e) {
    this.decoders = e;
  }
  or(e) {
    return gu(this, e);
  }
  decode(e) {
    const r = e[0], n = this.decoders[r];
    if (n)
      return n.decode(e);
    throw RangeError(`Unable to decode multibase string ${JSON.stringify(e)}, only inputs prefixed with ${Object.keys(this.decoders)} are supported`);
  }
}
const gu = (t, e) => new xy({
  ...t.decoders || { [t.prefix]: t },
  ...e.decoders || { [e.prefix]: e }
});
class Ly {
  constructor(e, r, n, s) {
    this.name = e, this.prefix = r, this.baseEncode = n, this.baseDecode = s, this.encoder = new Uy(e, r, n), this.decoder = new Ky(e, r, s);
  }
  encode(e) {
    return this.encoder.encode(e);
  }
  decode(e) {
    return this.decoder.decode(e);
  }
}
const Ny = ({ name: t, prefix: e, encode: r, decode: n }) => new Ly(t, e, r, n), Wy = (t, e, r, n) => {
  const s = {};
  for (let u = 0; u < e.length; ++u)
    s[e[u]] = u;
  let a = t.length;
  for (; t[a - 1] === "="; )
    --a;
  const o = new Uint8Array(a * r / 8 | 0);
  let i = 0, c = 0, d = 0;
  for (let u = 0; u < a; ++u) {
    const l = s[t[u]];
    if (l === void 0)
      throw new SyntaxError(`Non-${n} character`);
    c = c << r | l, i += r, i >= 8 && (i -= 8, o[d++] = 255 & c >> i);
  }
  if (i >= r || 255 & c << 8 - i)
    throw new SyntaxError("Unexpected end of data");
  return o;
}, Hy = (t, e, r) => {
  const n = e[e.length - 1] === "=", s = (1 << r) - 1;
  let a = "", o = 0, i = 0;
  for (let c = 0; c < t.length; ++c)
    for (i = i << 8 | t[c], o += 8; o > r; )
      o -= r, a += e[s & i >> o];
  if (o && (a += e[s & i << r - o]), n)
    for (; a.length * r & 7; )
      a += "=";
  return a;
}, Ra = ({ name: t, prefix: e, bitsPerChar: r, alphabet: n }) => Ny({
  prefix: e,
  name: t,
  encode(s) {
    return Hy(s, n, r);
  },
  decode(s) {
    return Wy(s, n, r, t);
  }
}), Jy = Ra({
  prefix: "m",
  name: "base64",
  alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
  bitsPerChar: 6
}), Zy = Ra({
  prefix: "M",
  name: "base64pad",
  alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  bitsPerChar: 6
}), Fy = Ra({
  prefix: "u",
  name: "base64url",
  alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
  bitsPerChar: 6
}), By = Ra({
  prefix: "U",
  name: "base64urlpad",
  alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=",
  bitsPerChar: 6
}), Vy = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  base64: Jy,
  base64pad: Zy,
  base64url: Fy,
  base64urlpad: By
}, Symbol.toStringTag, { value: "Module" })), Wi = /* @__PURE__ */ Kd(Vy);
Object.defineProperty(ce, "__esModule", { value: !0 });
ce.segmentedStringRefinementFactory = ce.jwtCharsRefinement = ce.cachedGetter = ce.preferredOrderCmp = ce.isDefined = void 0;
ce.matchesAny = Xy;
ce.parseB64uJson = tm;
ce.isLastOccurrence = sm;
const qy = Wi, fr = R, Gy = (t) => t !== void 0;
ce.isDefined = Gy;
const Yy = (t) => (e, r) => {
  const n = t.indexOf(e), s = t.indexOf(r);
  return n === s ? 0 : n === -1 ? 1 : s === -1 ? -1 : n - s;
};
ce.preferredOrderCmp = Yy;
function Xy(t) {
  return t == null ? (e) => !0 : Array.isArray(t) ? (e) => t.includes(e) : (e) => e === t;
}
const Qy = (t, e) => function() {
  const r = t.call(this);
  return Object.defineProperty(this, t.name, {
    get: () => r,
    enumerable: !0,
    configurable: !0
  }), r;
};
ce.cachedGetter = Qy;
const em = new TextDecoder();
function tm(t) {
  const e = qy.base64url.baseDecode(t), r = em.decode(e);
  return JSON.parse(r);
}
const rm = (t, e) => {
  let r;
  for (let n = 0; n < t.length; n++)
    if (r = t.charCodeAt(n), // Base64 URL encoding (most frequent)
    !(65 <= r && r <= 90 || // A-Z
    97 <= r && r <= 122 || // a-z
    48 <= r && r <= 57 || // 0-9
    r === 45 || // -
    r === 95 || // _
    // Boundary (least frequent, check last)
    r === 46)) {
      const s = String.fromCodePoint(t.codePointAt(n));
      return e.addIssue({
        code: fr.ZodIssueCode.custom,
        message: `Invalid character "${s}" in JWT at position ${n}`
      });
    }
};
ce.jwtCharsRefinement = rm;
const nm = (t, e = 2) => {
  if (!Number.isFinite(t) || t < 1 || (t | 0) !== t)
    throw new TypeError(`Count must be a natural number (got ${t})`);
  const r = t * e + (t - 1), n = "Invalid JWT format";
  return (s, a) => {
    if (s.length < r)
      return a.addIssue({
        code: fr.ZodIssueCode.custom,
        message: `${n}: too short`
      }), !1;
    let o = 0;
    for (let i = 0; i < t - 1; i++) {
      const c = s.indexOf(".", o);
      if (c === -1)
        return a.addIssue({
          code: fr.ZodIssueCode.custom,
          message: `${n}: expected ${t} segments, got ${i + 1}`
        }), !1;
      if (c - o < e)
        return a.addIssue({
          code: fr.ZodIssueCode.custom,
          message: `${n}: segment ${i + 1} is too short`
        }), !1;
      o = c + 1;
    }
    return s.indexOf(".", o) !== -1 ? (a.addIssue({
      code: fr.ZodIssueCode.custom,
      message: `${n}: too many segments`
    }), !1) : s.length - o < e ? (a.addIssue({
      code: fr.ZodIssueCode.custom,
      message: `${n}: last segment is too short`
    }), !1) : !0;
  };
};
ce.segmentedStringRefinementFactory = nm;
function sm(t, e, r) {
  return r.indexOf(t, e + 1) === -1;
}
(function(t) {
  Object.defineProperty(t, "__esModule", { value: !0 }), t.jwkPrivateSchema = t.jwkPubSchema = t.jwkValidator = t.jwkSchema = t.keyUsageSchema = t.KEY_USAGE = t.privateKeyUsageSchema = t.PRIVATE_KEY_USAGE = t.publicKeyUsageSchema = t.PUBLIC_KEY_USAGE = void 0, t.isPublicKeyUsage = n, t.isSigKeyUsage = s, t.isEncKeyUsage = a, t.isPrivateKeyUsage = o, t.hasKid = f, t.hasSharedSecretJwk = _, t.hasPrivateSecretJwk = g, t.isPrivateJwk = S, t.isPublicJwk = w;
  const e = R, r = ce;
  t.PUBLIC_KEY_USAGE = ["verify", "encrypt", "wrapKey"], t.publicKeyUsageSchema = e.z.enum(t.PUBLIC_KEY_USAGE);
  function n(b) {
    return t.PUBLIC_KEY_USAGE.includes(b);
  }
  function s(b) {
    return b === "verify";
  }
  function a(b) {
    return b === "encrypt" || b === "wrapKey";
  }
  t.PRIVATE_KEY_USAGE = [
    "sign",
    "decrypt",
    "unwrapKey",
    "deriveKey",
    "deriveBits"
  ], t.privateKeyUsageSchema = e.z.enum(t.PRIVATE_KEY_USAGE);
  function o(b) {
    return t.PRIVATE_KEY_USAGE.includes(b);
  }
  t.KEY_USAGE = [...t.PRIVATE_KEY_USAGE, ...t.PUBLIC_KEY_USAGE], t.keyUsageSchema = e.z.enum(t.KEY_USAGE);
  const i = e.z.object({
    kty: e.z.string().min(1),
    alg: e.z.string().min(1).optional(),
    kid: e.z.string().min(1).optional(),
    use: e.z.enum(["sig", "enc"]).optional(),
    key_ops: e.z.array(t.keyUsageSchema).min(1, { message: "At least one key usage must be specified" }).refine((b) => b.every(r.isLastOccurrence), {
      message: "key_ops must not contain duplicates"
    }).optional(),
    x5c: e.z.array(e.z.string()).optional(),
    // X.509 Certificate Chain
    x5t: e.z.string().min(1).optional(),
    // X.509 Certificate SHA-1 Thumbprint
    "x5t#S256": e.z.string().min(1).optional(),
    // X.509 Certificate SHA-256 Thumbprint
    x5u: e.z.string().url().optional(),
    // X.509 URL
    // https://www.w3.org/TR/webcrypto/
    ext: e.z.boolean().optional(),
    // Extractable
    // Federation Historical Keys Response
    // https://openid.net/specs/openid-federation-1_0.html#name-federation-historical-keys-res
    iat: e.z.number().int().optional(),
    // Issued At (timestamp)
    exp: e.z.number().int().optional(),
    // Expiration Time (timestamp)
    nbf: e.z.number().int().optional(),
    // Not Before (timestamp)
    revoked: e.z.object({
      revoked_at: e.z.number().int(),
      reason: e.z.string().optional()
    }).optional()
  }), c = i.extend({
    kty: e.z.literal("RSA"),
    alg: e.z.enum(["RS256", "RS384", "RS512", "PS256", "PS384", "PS512"]).optional(),
    n: e.z.string().min(1),
    // Modulus
    e: e.z.string().min(1),
    // Exponent
    d: e.z.string().min(1).optional(),
    // Private Exponent
    p: e.z.string().min(1).optional(),
    // First Prime Factor
    q: e.z.string().min(1).optional(),
    // Second Prime Factor
    dp: e.z.string().min(1).optional(),
    // First Factor CRT Exponent
    dq: e.z.string().min(1).optional(),
    // Second Factor CRT Exponent
    qi: e.z.string().min(1).optional(),
    // First CRT Coefficient
    oth: e.z.array(e.z.object({
      r: e.z.string().optional(),
      d: e.z.string().optional(),
      t: e.z.string().optional()
    })).min(1).optional()
    // Other Primes Info
  }), d = i.extend({
    kty: e.z.literal("EC"),
    alg: e.z.enum(["ES256", "ES384", "ES512"]).optional(),
    crv: e.z.enum(["P-256", "P-384", "P-521"]),
    x: e.z.string().min(1),
    y: e.z.string().min(1),
    d: e.z.string().min(1).optional()
    // ECC Private Key
  }), u = i.extend({
    kty: e.z.literal("EC"),
    alg: e.z.enum(["ES256K"]).optional(),
    crv: e.z.enum(["secp256k1"]),
    x: e.z.string().min(1),
    y: e.z.string().min(1),
    d: e.z.string().min(1).optional()
    // ECC Private Key
  }), l = i.extend({
    kty: e.z.literal("OKP"),
    alg: e.z.enum(["EdDSA"]).optional(),
    crv: e.z.enum(["Ed25519", "Ed448"]),
    x: e.z.string().min(1),
    d: e.z.string().min(1).optional()
    // ECC Private Key
  }), p = i.extend({
    kty: e.z.literal("oct"),
    // Octet Sequence (used to represent symmetric keys)
    alg: e.z.enum(["HS256", "HS384", "HS512"]).optional(),
    k: e.z.string()
    // Key Value (base64url encoded)
  });
  t.jwkSchema = e.z.union([
    c,
    d,
    u,
    l,
    p
  ]).refine(
    // https://datatracker.ietf.org/doc/html/rfc7517#section-4.2
    // > The "use" (public key use) parameter identifies the intended use of the
    // > public key
    (b) => b.use == null || w(b),
    {
      message: '"use" can only be used with public keys',
      path: ["use"]
    }
  ).refine((b) => {
    var D;
    return !((D = b.key_ops) != null && D.some(o)) || S(b);
  }, {
    message: "private key usage not allowed for public keys",
    path: ["key_ops"]
  }).refine(
    // https://datatracker.ietf.org/doc/html/rfc7517#section-4.3
    // > The "use" and "key_ops" JWK members SHOULD NOT be used together;
    // > however, if both are used, the information they convey MUST be
    // > consistent.
    (b) => b.use == null || b.key_ops == null || b.use === "sig" && b.key_ops.every(s) || b.use === "enc" && b.key_ops.every(a),
    {
      message: '"key_ops" must be consistent with "use"',
      path: ["key_ops"]
    }
  ), t.jwkValidator = t.jwkSchema, t.jwkPubSchema = t.jwkSchema.refine(f, {
    message: '"kid" is required',
    path: ["kid"]
  }).refine(w, {
    message: "private key not allowed"
  }).refine((b) => !b.key_ops || b.key_ops.every(n), {
    message: '"key_ops" must not contain private key usage for public keys',
    path: ["key_ops"]
  }), t.jwkPrivateSchema = t.jwkSchema.refine(S, {
    message: "private key required"
  });
  function f(b) {
    return "kid" in b && b.kid != null;
  }
  function _(b) {
    return "k" in b && b.k != null;
  }
  function g(b) {
    return "d" in b && b.d != null;
  }
  function S(b) {
    return g(b) || _(b);
  }
  function w(b) {
    return !g(b) && !_(b);
  }
})(Cr);
Object.defineProperty(Ta, "__esModule", { value: !0 });
Ta.jwkAlgorithms = am;
const Ho = Dn, wu = Cr, { process: Ds } = globalThis;
var Rd;
const Jc = typeof Ds < "u" && typeof ((Rd = Ds == null ? void 0 : Ds.versions) == null ? void 0 : Rd.node) == "string";
function* am(t) {
  if (typeof t.alg == "string") {
    yield t.alg;
    return;
  }
  switch (t.kty) {
    case "EC": {
      if (Jo(t) && (yield "ECDH-ES", yield "ECDH-ES+A128KW", yield "ECDH-ES+A192KW", yield "ECDH-ES+A256KW"), Zo(t)) {
        const e = "crv" in t ? t.crv : void 0;
        switch (e) {
          case "P-256":
          case "P-384":
            yield `ES${e.slice(-3)}`;
            break;
          case "P-521":
            yield "ES512";
            break;
          case "secp256k1":
            Jc && (yield "ES256K");
            break;
          default:
            throw new Ho.JwkError(`Unsupported crv "${e}"`);
        }
      }
      return;
    }
    case "OKP": {
      if (!t.use)
        throw new Ho.JwkError('Missing "use" Parameter value');
      yield "ECDH-ES", yield "ECDH-ES+A128KW", yield "ECDH-ES+A192KW", yield "ECDH-ES+A256KW";
      return;
    }
    case "RSA": {
      Jo(t) && (yield "RSA-OAEP", yield "RSA-OAEP-256", yield "RSA-OAEP-384", yield "RSA-OAEP-512", Jc && (yield "RSA1_5")), Zo(t) && (yield "PS256", yield "PS384", yield "PS512", yield "RS256", yield "RS384", yield "RS512");
      return;
    }
    case "oct": {
      Jo(t) && (yield "A128GCMKW", yield "A192GCMKW", yield "A256GCMKW", yield "A128KW", yield "A192KW", yield "A256KW"), Zo(t) && (yield "HS256", yield "HS384", yield "HS512");
      return;
    }
    default:
      throw new Ho.JwkError(`Unsupported kty "${t.kty}"`);
  }
}
function Jo(t) {
  var e;
  return ((e = t.key_ops) == null ? void 0 : e.some(wu.isEncKeyUsage)) ?? (t.use == null || t.use === "enc");
}
function Zo(t) {
  var e;
  return ((e = t.key_ops) == null ? void 0 : e.some(wu.isSigKeyUsage)) ?? (t.use == null || t.use === "sig");
}
var Ar = {};
Object.defineProperty(Ar, "__esModule", { value: !0 });
Ar.jwksPubSchema = Ar.jwksSchema = void 0;
const _r = R, vu = Cr;
Ar.jwksSchema = _r.z.object({
  keys: _r.z.array(_r.z.unknown()).transform((t) => t.map((e) => vu.jwkSchema.safeParse(e)).filter((e) => e.success).map((e) => e.data))
});
Ar.jwksPubSchema = _r.z.object({
  keys: _r.z.array(_r.z.unknown()).transform((t) => t.map((e) => vu.jwkPubSchema.safeParse(e)).filter((e) => e.success).map((e) => e.data))
});
var ka = {}, Hi = {};
(function(t) {
  Object.defineProperty(t, "__esModule", { value: !0 }), t.jwtPayloadSchema = t.htuSchema = t.jwtHeaderSchema = t.isUnsignedJwt = t.unsignedJwtSchema = t.isSignedJwt = t.signedJwtSchema = void 0;
  const e = R, r = Cr, n = ce;
  t.signedJwtSchema = e.z.string().superRefine(n.jwtCharsRefinement).superRefine((0, n.segmentedStringRefinementFactory)(3));
  const s = (o) => t.signedJwtSchema.safeParse(o).success;
  t.isSignedJwt = s, t.unsignedJwtSchema = e.z.string().superRefine(n.jwtCharsRefinement).superRefine((0, n.segmentedStringRefinementFactory)(2));
  const a = (o) => t.unsignedJwtSchema.safeParse(o).success;
  t.isUnsignedJwt = a, t.jwtHeaderSchema = e.z.object({
    /** "alg" (Algorithm) Header Parameter */
    alg: e.z.string(),
    /** "jku" (JWK Set URL) Header Parameter */
    jku: e.z.string().url().optional(),
    /** "jwk" (JSON Web Key) Header Parameter */
    jwk: e.z.object({
      kty: e.z.string(),
      crv: e.z.string().optional(),
      x: e.z.string().optional(),
      y: e.z.string().optional(),
      e: e.z.string().optional(),
      n: e.z.string().optional()
    }).optional(),
    /** "kid" (Key ID) Header Parameter */
    kid: e.z.string().optional(),
    /** "x5u" (X.509 URL) Header Parameter */
    x5u: e.z.string().optional(),
    /** "x5c" (X.509 Certificate Chain) Header Parameter */
    x5c: e.z.array(e.z.string()).optional(),
    /** "x5t" (X.509 Certificate SHA-1 Thumbprint) Header Parameter */
    x5t: e.z.string().optional(),
    /** "x5t#S256" (X.509 Certificate SHA-256 Thumbprint) Header Parameter */
    "x5t#S256": e.z.string().optional(),
    /** "typ" (Type) Header Parameter */
    typ: e.z.string().optional(),
    /** "cty" (Content Type) Header Parameter */
    cty: e.z.string().optional(),
    /** "crit" (Critical) Header Parameter */
    crit: e.z.array(e.z.string()).optional()
  }).passthrough(), t.htuSchema = e.z.string().superRefine((o, i) => {
    try {
      const c = new URL(o);
      c.protocol !== "http:" && c.protocol !== "https:" && i.addIssue({
        code: e.z.ZodIssueCode.custom,
        message: "Only http: and https: protocols are allowed"
      }), (c.username || c.password) && i.addIssue({
        code: e.z.ZodIssueCode.custom,
        message: "Credentials not allowed"
      }), c.search && i.addIssue({
        code: e.z.ZodIssueCode.custom,
        message: "Query string not allowed"
      }), c.hash && i.addIssue({
        code: e.z.ZodIssueCode.custom,
        message: "Fragment not allowed"
      });
    } catch {
      i.addIssue({
        code: e.z.ZodIssueCode.invalid_string,
        validation: "url"
      });
    }
    return o;
  }), t.jwtPayloadSchema = e.z.object({
    iss: e.z.string().optional(),
    aud: e.z.union([e.z.string(), e.z.array(e.z.string()).nonempty()]).optional(),
    sub: e.z.string().optional(),
    exp: e.z.number().int().optional(),
    nbf: e.z.number().int().optional(),
    iat: e.z.number().int().optional(),
    jti: e.z.string().optional(),
    htm: e.z.string().optional(),
    htu: t.htuSchema.optional(),
    ath: e.z.string().optional(),
    acr: e.z.string().optional(),
    azp: e.z.string().optional(),
    amr: e.z.array(e.z.string()).optional(),
    // https://datatracker.ietf.org/doc/html/rfc7800
    cnf: e.z.object({
      kid: e.z.string().optional(),
      // Key ID
      jwk: r.jwkPubSchema.optional(),
      // JWK
      jwe: e.z.string().optional(),
      // Encrypted key
      jku: e.z.string().url().optional(),
      // JWK Set URI ("kid" should also be provided)
      // https://datatracker.ietf.org/doc/html/rfc9449#section-6.1
      jkt: e.z.string().optional(),
      // https://datatracker.ietf.org/doc/html/rfc8705
      "x5t#S256": e.z.string().optional(),
      // X.509 Certificate SHA-256 Thumbprint
      // https://datatracker.ietf.org/doc/html/rfc9203
      osc: e.z.string().optional()
      // OSCORE_Input_Material carrying the parameters for using OSCORE per-message security with implicit key confirmation
    }).optional(),
    client_id: e.z.string().optional(),
    scope: e.z.string().optional(),
    nonce: e.z.string().optional(),
    at_hash: e.z.string().optional(),
    c_hash: e.z.string().optional(),
    s_hash: e.z.string().optional(),
    auth_time: e.z.number().int().optional(),
    // https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
    // OpenID: "profile" scope
    name: e.z.string().optional(),
    family_name: e.z.string().optional(),
    given_name: e.z.string().optional(),
    middle_name: e.z.string().optional(),
    nickname: e.z.string().optional(),
    preferred_username: e.z.string().optional(),
    gender: e.z.string().optional(),
    // OpenID only defines "male" and "female" without forbidding other values
    picture: e.z.string().url().optional(),
    profile: e.z.string().url().optional(),
    website: e.z.string().url().optional(),
    birthdate: e.z.string().regex(/\d{4}-\d{2}-\d{2}/).optional(),
    zoneinfo: e.z.string().regex(/^[A-Za-z0-9_/]+$/).optional(),
    locale: e.z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/).optional(),
    updated_at: e.z.number().int().optional(),
    // OpenID: "email" scope
    email: e.z.string().optional(),
    email_verified: e.z.boolean().optional(),
    // OpenID: "phone" scope
    phone_number: e.z.string().optional(),
    phone_number_verified: e.z.boolean().optional(),
    // OpenID: "address" scope
    // https://openid.net/specs/openid-connect-core-1_0.html#AddressClaim
    address: e.z.object({
      formatted: e.z.string().optional(),
      street_address: e.z.string().optional(),
      locality: e.z.string().optional(),
      region: e.z.string().optional(),
      postal_code: e.z.string().optional(),
      country: e.z.string().optional()
    }).optional(),
    // https://datatracker.ietf.org/doc/html/rfc9396#section-14.2
    authorization_details: e.z.array(e.z.object({
      type: e.z.string(),
      // https://datatracker.ietf.org/doc/html/rfc9396#section-2.2
      locations: e.z.array(e.z.string()).optional(),
      actions: e.z.array(e.z.string()).optional(),
      datatypes: e.z.array(e.z.string()).optional(),
      identifier: e.z.string().optional(),
      privileges: e.z.array(e.z.string()).optional()
    }).passthrough()).optional()
  }).passthrough();
})(Hi);
Object.defineProperty(ka, "__esModule", { value: !0 });
ka.unsafeDecodeJwt = om;
const zs = Dn, Zc = Hi, Fc = ce;
function om(t) {
  const { 0: e, 1: r, length: n } = t.split(".");
  if (n > 3 || n < 2)
    throw new zs.JwtVerifyError(void 0, zs.ERR_JWT_INVALID);
  const s = Zc.jwtHeaderSchema.parse((0, Fc.parseB64uJson)(e));
  if (n === 2 && (s == null ? void 0 : s.alg) !== "none")
    throw new zs.JwtVerifyError(void 0, zs.ERR_JWT_INVALID);
  const a = Zc.jwtPayloadSchema.parse((0, Fc.parseB64uJson)(r));
  return { header: s, payload: a };
}
var bu = {};
Object.defineProperty(bu, "__esModule", { value: !0 });
var ja = {}, im = v && v.__runInitializers || function(t, e, r) {
  for (var n = arguments.length > 2, s = 0; s < e.length; s++)
    r = n ? e[s].call(t, r) : e[s].call(t);
  return n ? r : void 0;
}, Gr = v && v.__esDecorate || function(t, e, r, n, s, a) {
  function o(w) {
    if (w !== void 0 && typeof w != "function") throw new TypeError("Function expected");
    return w;
  }
  for (var i = n.kind, c = i === "getter" ? "get" : i === "setter" ? "set" : "value", d = !e && t ? n.static ? t : t.prototype : null, u = e || (d ? Object.getOwnPropertyDescriptor(d, n.name) : {}), l, p = !1, f = r.length - 1; f >= 0; f--) {
    var _ = {};
    for (var g in n) _[g] = g === "access" ? {} : n[g];
    for (var g in n.access) _.access[g] = n.access[g];
    _.addInitializer = function(w) {
      if (p) throw new TypeError("Cannot add initializers after decoration has completed");
      a.push(o(w || null));
    };
    var S = (0, r[f])(i === "accessor" ? { get: u.get, set: u.set } : u[c], _);
    if (i === "accessor") {
      if (S === void 0) continue;
      if (S === null || typeof S != "object") throw new TypeError("Object expected");
      (l = o(S.get)) && (u.get = l), (l = o(S.set)) && (u.set = l), (l = o(S.init)) && s.unshift(l);
    } else (l = o(S)) && (i === "field" ? s.unshift(l) : u[c] = l);
  }
  d && Object.defineProperty(d, n.name, u), p = !0;
};
Object.defineProperty(ja, "__esModule", { value: !0 });
ja.Key = void 0;
const cm = Ta, ft = Cr, Yr = ce;
let dm = (() => {
  var t;
  let e = [], r, n, s, a, o;
  return t = class {
    constructor(c) {
      Object.defineProperty(this, "jwk", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: (im(this, e), c)
      });
    }
    get isPrivate() {
      return (0, ft.isPrivateJwk)(this.jwk);
    }
    get isSymetric() {
      return (0, ft.hasSharedSecretJwk)(this.jwk);
    }
    get privateJwk() {
      if (this.isPrivate)
        return this.jwk;
    }
    get publicJwk() {
      if (this.isSymetric)
        return;
      if (!this.isPrivate)
        return this.jwk;
      const c = ft.jwkPubSchema.safeParse({
        ...this.jwk,
        d: void 0,
        k: void 0,
        use: void 0,
        key_ops: um(this.keyOps) ?? ft.PUBLIC_KEY_USAGE
      });
      if (c.success)
        return Object.freeze(c.data);
    }
    get bareJwk() {
      if (this.isSymetric)
        return;
      const { kty: c, crv: d, e: u, n: l, x: p, y: f } = this.jwk;
      return Object.freeze(ft.jwkSchema.parse({ crv: d, e: u, kty: c, n: l, x: p, y: f }));
    }
    /**
     * @note Only defined on public keys
     */
    get use() {
      return this.jwk.use;
    }
    get keyOps() {
      return this.jwk.key_ops;
    }
    /**
     * The (forced) algorithm to use. If not provided, the key will be usable with
     * any of the algorithms in {@link algorithms}.
     *
     * @see {@link https://datatracker.ietf.org/doc/html/rfc7518#section-3.1 | "alg" (Algorithm) Header Parameter Values for JWS}
     */
    get alg() {
      return this.jwk.alg;
    }
    get kid() {
      return this.jwk.kid;
    }
    get crv() {
      return this.jwk.crv;
    }
    /**
     * All the algorithms that this key can be used with. If `alg` is provided,
     * this set will only contain that algorithm.
     */
    get algorithms() {
      return Object.freeze(Array.from((0, cm.jwkAlgorithms)(this.jwk)));
    }
    get isRevoked() {
      return this.jwk.revoked != null;
    }
    isActive(c) {
      var u;
      if (!(c != null && c.allowRevoked) && this.isRevoked)
        return !1;
      const d = (c == null ? void 0 : c.clockTolerance) ?? 0;
      if (d !== 1 / 0) {
        const l = ((u = c == null ? void 0 : c.currentDate) == null ? void 0 : u.getTime()) ?? Date.now(), { exp: p, nbf: f } = this.jwk;
        if (f != null && !(l >= f * 1e3 - d) || p != null && !(l < p * 1e3 + d))
          return !1;
      }
      return !0;
    }
    matches(c) {
      return !(c.kid != null && !(Array.isArray(c.kid) ? this.kid != null && c.kid.includes(this.kid) : this.kid === c.kid) || c.alg != null && !(Array.isArray(c.alg) ? c.alg.some((u) => this.algorithms.includes(u)) : this.algorithms.includes(c.alg)) || c.usage != null && (!(this.keyOps == null || this.keyOps.includes(c.usage) || // @NOTE Because this.jwk represents the private key (typically used for
      // private operations), the public counterpart operations are allowed.
      c.usage === "verify" && this.keyOps.includes("sign") || c.usage === "encrypt" && this.keyOps.includes("decrypt") || c.usage === "wrapKey" && this.keyOps.includes("unwrapKey")) || !(this.use == null || this.use === "sig" && (0, ft.isSigKeyUsage)(c.usage) || this.use === "enc" && (0, ft.isEncKeyUsage)(c.usage)) || !(this.isPrivate || (0, ft.isPublicKeyUsage)(c.usage))));
    }
  }, (() => {
    const i = typeof Symbol == "function" && Symbol.metadata ? /* @__PURE__ */ Object.create(null) : void 0;
    r = [Yr.cachedGetter], n = [Yr.cachedGetter], s = [Yr.cachedGetter], a = [Yr.cachedGetter], o = [Yr.cachedGetter], Gr(t, null, r, { kind: "getter", name: "isPrivate", static: !1, private: !1, access: { has: (c) => "isPrivate" in c, get: (c) => c.isPrivate }, metadata: i }, null, e), Gr(t, null, n, { kind: "getter", name: "isSymetric", static: !1, private: !1, access: { has: (c) => "isSymetric" in c, get: (c) => c.isSymetric }, metadata: i }, null, e), Gr(t, null, s, { kind: "getter", name: "publicJwk", static: !1, private: !1, access: { has: (c) => "publicJwk" in c, get: (c) => c.publicJwk }, metadata: i }, null, e), Gr(t, null, a, { kind: "getter", name: "bareJwk", static: !1, private: !1, access: { has: (c) => "bareJwk" in c, get: (c) => c.bareJwk }, metadata: i }, null, e), Gr(t, null, o, { kind: "getter", name: "algorithms", static: !1, private: !1, access: { has: (c) => "algorithms" in c, get: (c) => c.algorithms }, metadata: i }, null, e), i && Object.defineProperty(t, Symbol.metadata, { enumerable: !0, configurable: !0, writable: !0, value: i });
  })(), t;
})();
ja.Key = dm;
function um(t) {
  if (t == null)
    return;
  const e = new Set(t.filter(ft.isPublicKeyUsage));
  return t.includes("sign") && e.add("verify"), t.includes("decrypt") && e.add("encrypt"), t.includes("unwrapKey") && e.add("wrapKey"), Array.from(e);
}
var Da = {}, lm = v && v.__runInitializers || function(t, e, r) {
  for (var n = arguments.length > 2, s = 0; s < e.length; s++)
    r = n ? e[s].call(t, r) : e[s].call(t);
  return n ? r : void 0;
}, Fo = v && v.__esDecorate || function(t, e, r, n, s, a) {
  function o(w) {
    if (w !== void 0 && typeof w != "function") throw new TypeError("Function expected");
    return w;
  }
  for (var i = n.kind, c = i === "getter" ? "get" : i === "setter" ? "set" : "value", d = !e && t ? n.static ? t : t.prototype : null, u = e || (d ? Object.getOwnPropertyDescriptor(d, n.name) : {}), l, p = !1, f = r.length - 1; f >= 0; f--) {
    var _ = {};
    for (var g in n) _[g] = g === "access" ? {} : n[g];
    for (var g in n.access) _.access[g] = n.access[g];
    _.addInitializer = function(w) {
      if (p) throw new TypeError("Cannot add initializers after decoration has completed");
      a.push(o(w || null));
    };
    var S = (0, r[f])(i === "accessor" ? { get: u.get, set: u.set } : u[c], _);
    if (i === "accessor") {
      if (S === void 0) continue;
      if (S === null || typeof S != "object") throw new TypeError("Object expected");
      (l = o(S.get)) && (u.get = l), (l = o(S.set)) && (u.set = l), (l = o(S.init)) && s.unshift(l);
    } else (l = o(S)) && (i === "field" ? s.unshift(l) : u[c] = l);
  }
  d && Object.defineProperty(d, n.name, u), p = !0;
};
Object.defineProperty(Da, "__esModule", { value: !0 });
Da.Keyset = void 0;
const Me = Dn, hm = ka, Ht = ce, fm = (t) => t.privateJwk, pm = (t) => t.publicJwk;
let ym = (() => {
  var t;
  let e = [], r, n, s;
  return t = class {
    constructor(o, i = o instanceof t ? [...o.preferredSigningAlgorithms] : [
      // Prefer elliptic curve algorithms
      "EdDSA",
      "ES256K",
      "ES256",
      // https://datatracker.ietf.org/doc/html/rfc7518#section-3.5
      "PS256",
      "PS384",
      "PS512",
      "HS256",
      "HS384",
      "HS512"
    ]) {
      Object.defineProperty(this, "preferredSigningAlgorithms", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: (lm(this, e), i)
      }), Object.defineProperty(this, "keys", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0
      });
      const c = [], d = /* @__PURE__ */ new Set();
      for (const u of o)
        if (u && (c.push(u), u.kid)) {
          if (d.has(u.kid))
            throw new Me.JwkError(`Duplicate key: ${u.kid}`);
          d.add(u.kid);
        }
      this.keys = Object.freeze(c);
    }
    get size() {
      return this.keys.length;
    }
    get signAlgorithms() {
      const o = /* @__PURE__ */ new Set();
      for (const i of this)
        if (i.use === "sig")
          for (const c of i.algorithms)
            o.add(c);
      return Object.freeze([...o].sort((0, Ht.preferredOrderCmp)(this.preferredSigningAlgorithms)));
    }
    get publicJwks() {
      return Object.freeze({
        keys: Object.freeze(Array.from(this, pm).filter(Ht.isDefined))
      });
    }
    get privateJwks() {
      return Object.freeze({
        keys: Object.freeze(Array.from(this, fm).filter(Ht.isDefined))
      });
    }
    has(o) {
      return this.keys.some((i) => i.kid === o);
    }
    get(o) {
      const i = this.find(o);
      if (i)
        return i;
      throw new Me.JwkError(`Key not found ${o.kid ?? o.alg ?? o.usage ?? "<unknown>"}`, Me.ERR_JWK_NOT_FOUND);
    }
    find(o) {
      for (const i of this.list(o))
        return i;
    }
    *list(o) {
      for (const i of this)
        i.isActive(o) && i.matches(o) && (yield i);
    }
    findPrivateKey({ kid: o, alg: i, usage: c, ...d }) {
      const u = [];
      Array.isArray(i) && i.length === 1 && (i = i[0]);
      for (const f of this.list({ ...d, kid: o, alg: i, usage: c })) {
        if (typeof i == "string")
          return { key: f, alg: i };
        u.push(f);
      }
      const l = (0, Ht.matchesAny)(i), p = u.map((f) => [f, f.algorithms.filter(l)]);
      for (const f of this.preferredSigningAlgorithms)
        for (const [_, g] of p)
          if (g.includes(f))
            return { key: _, alg: f };
      for (const [f, _] of p)
        for (const g of _)
          return { key: f, alg: g };
      throw new Me.JwkError(`No private key found for ${o || i || c}`, Me.ERR_JWK_NOT_FOUND);
    }
    [(r = [Ht.cachedGetter], n = [Ht.cachedGetter], s = [Ht.cachedGetter], Symbol.iterator)]() {
      return this.keys.values();
    }
    async createJwt({ alg: o, kid: i, ...c }, d) {
      try {
        const { key: u, alg: l } = this.findPrivateKey({
          alg: o,
          kid: i,
          usage: "sign",
          allowRevoked: !1
          // For explicitness (default value is false)
        }), p = { ...c, alg: l, kid: u.kid };
        return typeof d == "function" && (d = await d(p, u)), await u.createJwt(p, d);
      } catch (u) {
        throw Me.JwtCreateError.from(u);
      }
    }
    async verifyJwt(o, i) {
      const { header: c } = (0, hm.unsafeDecodeJwt)(o), { kid: d, alg: u } = c, l = [];
      for (const p of this.list({ ...i, kid: d, alg: u, usage: "verify" }))
        try {
          return { ...await p.verifyJwt(o, i), key: p };
        } catch (f) {
          l.push(f);
        }
      switch (l.length) {
        case 0:
          throw new Me.JwtVerifyError("No key matched", Me.ERR_JWKS_NO_MATCHING_KEY);
        case 1:
          throw Me.JwtVerifyError.from(l[0], Me.ERR_JWT_INVALID);
        default:
          throw Me.JwtVerifyError.from(l, Me.ERR_JWT_INVALID);
      }
    }
    toJSON() {
      return structuredClone(this.publicJwks);
    }
  }, (() => {
    const a = typeof Symbol == "function" && Symbol.metadata ? /* @__PURE__ */ Object.create(null) : void 0;
    Fo(t, null, r, { kind: "getter", name: "signAlgorithms", static: !1, private: !1, access: { has: (o) => "signAlgorithms" in o, get: (o) => o.signAlgorithms }, metadata: a }, null, e), Fo(t, null, n, { kind: "getter", name: "publicJwks", static: !1, private: !1, access: { has: (o) => "publicJwks" in o, get: (o) => o.publicJwks }, metadata: a }, null, e), Fo(t, null, s, { kind: "getter", name: "privateJwks", static: !1, private: !1, access: { has: (o) => "privateJwks" in o, get: (o) => o.privateJwks }, metadata: a }, null, e), a && Object.defineProperty(t, Symbol.metadata, { enumerable: !0, configurable: !0, writable: !0, value: a });
  })(), t;
})();
Da.Keyset = ym;
(function(t) {
  var e = v && v.__createBinding || (Object.create ? function(s, a, o, i) {
    i === void 0 && (i = o);
    var c = Object.getOwnPropertyDescriptor(a, o);
    (!c || ("get" in c ? !a.__esModule : c.writable || c.configurable)) && (c = { enumerable: !0, get: function() {
      return a[o];
    } }), Object.defineProperty(s, i, c);
  } : function(s, a, o, i) {
    i === void 0 && (i = o), s[i] = a[o];
  }), r = v && v.__exportStar || function(s, a) {
    for (var o in s) o !== "default" && !Object.prototype.hasOwnProperty.call(a, o) && e(a, s, o);
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), t.ValidationError = void 0;
  var n = R;
  Object.defineProperty(t, "ValidationError", { enumerable: !0, get: function() {
    return n.ZodError;
  } }), r(Ta, t), r(Dn, t), r(Cr, t), r(Ar, t), r(ka, t), r(bu, t), r(Hi, t), r(ja, t), r(Da, t);
})(ct);
var Su = {}, za = {};
const M = crypto, Oe = (t) => t instanceof CryptoKey, Eu = async (t, e) => {
  const r = `SHA-${t.slice(-3)}`;
  return new Uint8Array(await M.subtle.digest(r, e));
}, te = new TextEncoder(), Ke = new TextDecoder(), ia = 2 ** 32;
function dt(...t) {
  const e = t.reduce((s, { length: a }) => s + a, 0), r = new Uint8Array(e);
  let n = 0;
  for (const s of t)
    r.set(s, n), n += s.length;
  return r;
}
function mm(t, e) {
  return dt(te.encode(t), new Uint8Array([0]), e);
}
function mi(t, e, r) {
  if (e < 0 || e >= ia)
    throw new RangeError(`value must be >= 0 and <= ${ia - 1}. Received ${e}`);
  t.set([e >>> 24, e >>> 16, e >>> 8, e & 255], r);
}
function Au(t) {
  const e = Math.floor(t / ia), r = t % ia, n = new Uint8Array(8);
  return mi(n, e, 0), mi(n, r, 4), n;
}
function Ji(t) {
  const e = new Uint8Array(4);
  return mi(e, t), e;
}
function Bo(t) {
  return dt(Ji(t.length), t);
}
async function _m(t, e, r) {
  const n = Math.ceil((e >> 3) / 32), s = new Uint8Array(n * 32);
  for (let a = 0; a < n; a++) {
    const o = new Uint8Array(4 + t.length + r.length);
    o.set(Ji(a + 1)), o.set(t, 4), o.set(r, 4 + t.length), s.set(await Eu("sha256", o), a * 32);
  }
  return s.slice(0, e >> 3);
}
const Zi = (t) => {
  let e = t;
  typeof e == "string" && (e = te.encode(e));
  const r = 32768, n = [];
  for (let s = 0; s < e.length; s += r)
    n.push(String.fromCharCode.apply(null, e.subarray(s, s + r)));
  return btoa(n.join(""));
}, se = (t) => Zi(t).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"), Pu = (t) => {
  const e = atob(t), r = new Uint8Array(e.length);
  for (let n = 0; n < e.length; n++)
    r[n] = e.charCodeAt(n);
  return r;
}, ee = (t) => {
  let e = t;
  e instanceof Uint8Array && (e = Ke.decode(e)), e = e.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  try {
    return Pu(e);
  } catch {
    throw new TypeError("The input to be decoded is not correctly encoded.");
  }
};
let fe = class extends Error {
  constructor(e, r) {
    var n;
    super(e, r), this.code = "ERR_JOSE_GENERIC", this.name = this.constructor.name, (n = Error.captureStackTrace) == null || n.call(Error, this, this.constructor);
  }
};
fe.code = "ERR_JOSE_GENERIC";
class Pe extends fe {
  constructor(e, r, n = "unspecified", s = "unspecified") {
    super(e, { cause: { claim: n, reason: s, payload: r } }), this.code = "ERR_JWT_CLAIM_VALIDATION_FAILED", this.claim = n, this.reason = s, this.payload = r;
  }
}
Pe.code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
class ca extends fe {
  constructor(e, r, n = "unspecified", s = "unspecified") {
    super(e, { cause: { claim: n, reason: s, payload: r } }), this.code = "ERR_JWT_EXPIRED", this.claim = n, this.reason = s, this.payload = r;
  }
}
ca.code = "ERR_JWT_EXPIRED";
class Pn extends fe {
  constructor() {
    super(...arguments), this.code = "ERR_JOSE_ALG_NOT_ALLOWED";
  }
}
Pn.code = "ERR_JOSE_ALG_NOT_ALLOWED";
class x extends fe {
  constructor() {
    super(...arguments), this.code = "ERR_JOSE_NOT_SUPPORTED";
  }
}
x.code = "ERR_JOSE_NOT_SUPPORTED";
class Pr extends fe {
  constructor(e = "decryption operation failed", r) {
    super(e, r), this.code = "ERR_JWE_DECRYPTION_FAILED";
  }
}
Pr.code = "ERR_JWE_DECRYPTION_FAILED";
class C extends fe {
  constructor() {
    super(...arguments), this.code = "ERR_JWE_INVALID";
  }
}
C.code = "ERR_JWE_INVALID";
class L extends fe {
  constructor() {
    super(...arguments), this.code = "ERR_JWS_INVALID";
  }
}
L.code = "ERR_JWS_INVALID";
class Ie extends fe {
  constructor() {
    super(...arguments), this.code = "ERR_JWT_INVALID";
  }
}
Ie.code = "ERR_JWT_INVALID";
class Fi extends fe {
  constructor() {
    super(...arguments), this.code = "ERR_JWK_INVALID";
  }
}
Fi.code = "ERR_JWK_INVALID";
class $a extends fe {
  constructor() {
    super(...arguments), this.code = "ERR_JWKS_INVALID";
  }
}
$a.code = "ERR_JWKS_INVALID";
class Ma extends fe {
  constructor(e = "no applicable key found in the JSON Web Key Set", r) {
    super(e, r), this.code = "ERR_JWKS_NO_MATCHING_KEY";
  }
}
Ma.code = "ERR_JWKS_NO_MATCHING_KEY";
class Bi extends fe {
  constructor(e = "multiple matching keys found in the JSON Web Key Set", r) {
    super(e, r), this.code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
  }
}
Bi.code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
class Vi extends fe {
  constructor(e = "request timed out", r) {
    super(e, r), this.code = "ERR_JWKS_TIMEOUT";
  }
}
Vi.code = "ERR_JWKS_TIMEOUT";
class Ua extends fe {
  constructor(e = "signature verification failed", r) {
    super(e, r), this.code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  }
}
Ua.code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
const gm = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  JOSEAlgNotAllowed: Pn,
  JOSEError: fe,
  JOSENotSupported: x,
  JWEDecryptionFailed: Pr,
  JWEInvalid: C,
  JWKInvalid: Fi,
  JWKSInvalid: $a,
  JWKSMultipleMatchingKeys: Bi,
  JWKSNoMatchingKey: Ma,
  JWKSTimeout: Vi,
  JWSInvalid: L,
  JWSSignatureVerificationFailed: Ua,
  JWTClaimValidationFailed: Pe,
  JWTExpired: ca,
  JWTInvalid: Ie
}, Symbol.toStringTag, { value: "Module" })), Ka = M.getRandomValues.bind(M);
function Iu(t) {
  switch (t) {
    case "A128GCM":
    case "A128GCMKW":
    case "A192GCM":
    case "A192GCMKW":
    case "A256GCM":
    case "A256GCMKW":
      return 96;
    case "A128CBC-HS256":
    case "A192CBC-HS384":
    case "A256CBC-HS512":
      return 128;
    default:
      throw new x(`Unsupported JWE Algorithm: ${t}`);
  }
}
const wm = (t) => Ka(new Uint8Array(Iu(t) >> 3)), Cu = (t, e) => {
  if (e.length << 3 !== Iu(t))
    throw new C("Invalid Initialization Vector length");
}, da = (t, e) => {
  const r = t.byteLength << 3;
  if (r !== e)
    throw new C(`Invalid Content Encryption Key length. Expected ${e} bits, got ${r} bits`);
}, vm = (t, e) => {
  if (!(t instanceof Uint8Array))
    throw new TypeError("First argument must be a buffer");
  if (!(e instanceof Uint8Array))
    throw new TypeError("Second argument must be a buffer");
  if (t.length !== e.length)
    throw new TypeError("Input buffers must have the same length");
  const r = t.length;
  let n = 0, s = -1;
  for (; ++s < r; )
    n |= t[s] ^ e[s];
  return n === 0;
};
function he(t, e = "algorithm.name") {
  return new TypeError(`CryptoKey does not support this operation, its ${e} must be ${t}`);
}
function yt(t, e) {
  return t.name === e;
}
function Vs(t) {
  return parseInt(t.name.slice(4), 10);
}
function bm(t) {
  switch (t) {
    case "ES256":
      return "P-256";
    case "ES384":
      return "P-384";
    case "ES512":
      return "P-521";
    default:
      throw new Error("unreachable");
  }
}
function Ou(t, e) {
  if (e.length && !e.some((r) => t.usages.includes(r))) {
    let r = "CryptoKey does not support this operation, its usages must include ";
    if (e.length > 2) {
      const n = e.pop();
      r += `one of ${e.join(", ")}, or ${n}.`;
    } else e.length === 2 ? r += `one of ${e[0]} or ${e[1]}.` : r += `${e[0]}.`;
    throw new TypeError(r);
  }
}
function Sm(t, e, ...r) {
  switch (e) {
    case "HS256":
    case "HS384":
    case "HS512": {
      if (!yt(t.algorithm, "HMAC"))
        throw he("HMAC");
      const n = parseInt(e.slice(2), 10);
      if (Vs(t.algorithm.hash) !== n)
        throw he(`SHA-${n}`, "algorithm.hash");
      break;
    }
    case "RS256":
    case "RS384":
    case "RS512": {
      if (!yt(t.algorithm, "RSASSA-PKCS1-v1_5"))
        throw he("RSASSA-PKCS1-v1_5");
      const n = parseInt(e.slice(2), 10);
      if (Vs(t.algorithm.hash) !== n)
        throw he(`SHA-${n}`, "algorithm.hash");
      break;
    }
    case "PS256":
    case "PS384":
    case "PS512": {
      if (!yt(t.algorithm, "RSA-PSS"))
        throw he("RSA-PSS");
      const n = parseInt(e.slice(2), 10);
      if (Vs(t.algorithm.hash) !== n)
        throw he(`SHA-${n}`, "algorithm.hash");
      break;
    }
    case "EdDSA": {
      if (t.algorithm.name !== "Ed25519" && t.algorithm.name !== "Ed448")
        throw he("Ed25519 or Ed448");
      break;
    }
    case "Ed25519": {
      if (!yt(t.algorithm, "Ed25519"))
        throw he("Ed25519");
      break;
    }
    case "ES256":
    case "ES384":
    case "ES512": {
      if (!yt(t.algorithm, "ECDSA"))
        throw he("ECDSA");
      const n = bm(e);
      if (t.algorithm.namedCurve !== n)
        throw he(n, "algorithm.namedCurve");
      break;
    }
    default:
      throw new TypeError("CryptoKey does not support this operation");
  }
  Ou(t, r);
}
function Kt(t, e, ...r) {
  switch (e) {
    case "A128GCM":
    case "A192GCM":
    case "A256GCM": {
      if (!yt(t.algorithm, "AES-GCM"))
        throw he("AES-GCM");
      const n = parseInt(e.slice(1, 4), 10);
      if (t.algorithm.length !== n)
        throw he(n, "algorithm.length");
      break;
    }
    case "A128KW":
    case "A192KW":
    case "A256KW": {
      if (!yt(t.algorithm, "AES-KW"))
        throw he("AES-KW");
      const n = parseInt(e.slice(1, 4), 10);
      if (t.algorithm.length !== n)
        throw he(n, "algorithm.length");
      break;
    }
    case "ECDH": {
      switch (t.algorithm.name) {
        case "ECDH":
        case "X25519":
        case "X448":
          break;
        default:
          throw he("ECDH, X25519, or X448");
      }
      break;
    }
    case "PBES2-HS256+A128KW":
    case "PBES2-HS384+A192KW":
    case "PBES2-HS512+A256KW":
      if (!yt(t.algorithm, "PBKDF2"))
        throw he("PBKDF2");
      break;
    case "RSA-OAEP":
    case "RSA-OAEP-256":
    case "RSA-OAEP-384":
    case "RSA-OAEP-512": {
      if (!yt(t.algorithm, "RSA-OAEP"))
        throw he("RSA-OAEP");
      const n = parseInt(e.slice(9), 10) || 1;
      if (Vs(t.algorithm.hash) !== n)
        throw he(`SHA-${n}`, "algorithm.hash");
      break;
    }
    default:
      throw new TypeError("CryptoKey does not support this operation");
  }
  Ou(t, r);
}
function Tu(t, e, ...r) {
  var n;
  if (r = r.filter(Boolean), r.length > 2) {
    const s = r.pop();
    t += `one of type ${r.join(", ")}, or ${s}.`;
  } else r.length === 2 ? t += `one of type ${r[0]} or ${r[1]}.` : t += `of type ${r[0]}.`;
  return e == null ? t += ` Received ${e}` : typeof e == "function" && e.name ? t += ` Received function ${e.name}` : typeof e == "object" && e != null && (n = e.constructor) != null && n.name && (t += ` Received an instance of ${e.constructor.name}`), t;
}
const be = (t, ...e) => Tu("Key must be ", t, ...e);
function Ru(t, e, ...r) {
  return Tu(`Key for the ${t} algorithm must be `, e, ...r);
}
const ku = (t) => Oe(t) ? !0 : (t == null ? void 0 : t[Symbol.toStringTag]) === "KeyObject", Se = ["CryptoKey"];
async function Em(t, e, r, n, s, a) {
  if (!(e instanceof Uint8Array))
    throw new TypeError(be(e, "Uint8Array"));
  const o = parseInt(t.slice(1, 4), 10), i = await M.subtle.importKey("raw", e.subarray(o >> 3), "AES-CBC", !1, ["decrypt"]), c = await M.subtle.importKey("raw", e.subarray(0, o >> 3), {
    hash: `SHA-${o << 1}`,
    name: "HMAC"
  }, !1, ["sign"]), d = dt(a, n, r, Au(a.length << 3)), u = new Uint8Array((await M.subtle.sign("HMAC", c, d)).slice(0, o >> 3));
  let l;
  try {
    l = vm(s, u);
  } catch {
  }
  if (!l)
    throw new Pr();
  let p;
  try {
    p = new Uint8Array(await M.subtle.decrypt({ iv: n, name: "AES-CBC" }, i, r));
  } catch {
  }
  if (!p)
    throw new Pr();
  return p;
}
async function Am(t, e, r, n, s, a) {
  let o;
  e instanceof Uint8Array ? o = await M.subtle.importKey("raw", e, "AES-GCM", !1, ["decrypt"]) : (Kt(e, t, "decrypt"), o = e);
  try {
    return new Uint8Array(await M.subtle.decrypt({
      additionalData: a,
      iv: n,
      name: "AES-GCM",
      tagLength: 128
    }, o, dt(r, s)));
  } catch {
    throw new Pr();
  }
}
const ju = async (t, e, r, n, s, a) => {
  if (!Oe(e) && !(e instanceof Uint8Array))
    throw new TypeError(be(e, ...Se, "Uint8Array"));
  if (!n)
    throw new C("JWE Initialization Vector missing");
  if (!s)
    throw new C("JWE Authentication Tag missing");
  switch (Cu(t, n), t) {
    case "A128CBC-HS256":
    case "A192CBC-HS384":
    case "A256CBC-HS512":
      return e instanceof Uint8Array && da(e, parseInt(t.slice(-3), 10)), Em(t, e, r, n, s, a);
    case "A128GCM":
    case "A192GCM":
    case "A256GCM":
      return e instanceof Uint8Array && da(e, parseInt(t.slice(1, 4), 10)), Am(t, e, r, n, s, a);
    default:
      throw new x("Unsupported JWE Content Encryption Algorithm");
  }
}, zn = (...t) => {
  const e = t.filter(Boolean);
  if (e.length === 0 || e.length === 1)
    return !0;
  let r;
  for (const n of e) {
    const s = Object.keys(n);
    if (!r || r.size === 0) {
      r = new Set(s);
      continue;
    }
    for (const a of s) {
      if (r.has(a))
        return !1;
      r.add(a);
    }
  }
  return !0;
};
function Pm(t) {
  return typeof t == "object" && t !== null;
}
function re(t) {
  if (!Pm(t) || Object.prototype.toString.call(t) !== "[object Object]")
    return !1;
  if (Object.getPrototypeOf(t) === null)
    return !0;
  let e = t;
  for (; Object.getPrototypeOf(e) !== null; )
    e = Object.getPrototypeOf(e);
  return Object.getPrototypeOf(t) === e;
}
const xa = [
  { hash: "SHA-256", name: "HMAC" },
  !0,
  ["sign"]
];
function Du(t, e) {
  if (t.algorithm.length !== parseInt(e.slice(1, 4), 10))
    throw new TypeError(`Invalid key size for alg: ${e}`);
}
function zu(t, e, r) {
  if (Oe(t))
    return Kt(t, e, r), t;
  if (t instanceof Uint8Array)
    return M.subtle.importKey("raw", t, "AES-KW", !0, [r]);
  throw new TypeError(be(t, ...Se, "Uint8Array"));
}
const _i = async (t, e, r) => {
  const n = await zu(e, t, "wrapKey");
  Du(n, t);
  const s = await M.subtle.importKey("raw", r, ...xa);
  return new Uint8Array(await M.subtle.wrapKey("raw", s, n, "AES-KW"));
}, gi = async (t, e, r) => {
  const n = await zu(e, t, "unwrapKey");
  Du(n, t);
  const s = await M.subtle.unwrapKey("raw", r, n, "AES-KW", ...xa);
  return new Uint8Array(await M.subtle.exportKey("raw", s));
};
async function $u(t, e, r, n, s = new Uint8Array(0), a = new Uint8Array(0)) {
  if (!Oe(t))
    throw new TypeError(be(t, ...Se));
  if (Kt(t, "ECDH"), !Oe(e))
    throw new TypeError(be(e, ...Se));
  Kt(e, "ECDH", "deriveBits");
  const o = dt(Bo(te.encode(r)), Bo(s), Bo(a), Ji(n));
  let i;
  t.algorithm.name === "X25519" ? i = 256 : t.algorithm.name === "X448" ? i = 448 : i = Math.ceil(parseInt(t.algorithm.namedCurve.substr(-3), 10) / 8) << 3;
  const c = new Uint8Array(await M.subtle.deriveBits({
    name: t.algorithm.name,
    public: t
  }, e, i));
  return _m(c, n, o);
}
async function Im(t) {
  if (!Oe(t))
    throw new TypeError(be(t, ...Se));
  return M.subtle.generateKey(t.algorithm, !0, ["deriveBits"]);
}
function Mu(t) {
  if (!Oe(t))
    throw new TypeError(be(t, ...Se));
  return ["P-256", "P-384", "P-521"].includes(t.algorithm.namedCurve) || t.algorithm.name === "X25519" || t.algorithm.name === "X448";
}
function Cm(t) {
  if (!(t instanceof Uint8Array) || t.length < 8)
    throw new C("PBES2 Salt Input must be 8 or more octets");
}
function Om(t, e) {
  if (t instanceof Uint8Array)
    return M.subtle.importKey("raw", t, "PBKDF2", !1, ["deriveBits"]);
  if (Oe(t))
    return Kt(t, e, "deriveBits", "deriveKey"), t;
  throw new TypeError(be(t, ...Se, "Uint8Array"));
}
async function Uu(t, e, r, n) {
  Cm(t);
  const s = mm(e, t), a = parseInt(e.slice(13, 16), 10), o = {
    hash: `SHA-${e.slice(8, 11)}`,
    iterations: r,
    name: "PBKDF2",
    salt: s
  }, i = {
    length: a,
    name: "AES-KW"
  }, c = await Om(n, e);
  if (c.usages.includes("deriveBits"))
    return new Uint8Array(await M.subtle.deriveBits(o, c, a));
  if (c.usages.includes("deriveKey"))
    return M.subtle.deriveKey(o, c, i, !1, ["wrapKey", "unwrapKey"]);
  throw new TypeError('PBKDF2 key "usages" must include "deriveBits" or "deriveKey"');
}
const Tm = async (t, e, r, n = 2048, s = Ka(new Uint8Array(16))) => {
  const a = await Uu(s, t, n, e);
  return { encryptedKey: await _i(t.slice(-6), a, r), p2c: n, p2s: se(s) };
}, Rm = async (t, e, r, n, s) => {
  const a = await Uu(s, t, n, e);
  return gi(t.slice(-6), a, r);
};
function ua(t) {
  switch (t) {
    case "RSA-OAEP":
    case "RSA-OAEP-256":
    case "RSA-OAEP-384":
    case "RSA-OAEP-512":
      return "RSA-OAEP";
    default:
      throw new x(`alg ${t} is not supported either by JOSE or your javascript runtime`);
  }
}
const La = (t, e) => {
  if (t.startsWith("RS") || t.startsWith("PS")) {
    const { modulusLength: r } = e.algorithm;
    if (typeof r != "number" || r < 2048)
      throw new TypeError(`${t} requires key modulusLength to be 2048 bits or larger`);
  }
}, km = async (t, e, r) => {
  if (!Oe(e))
    throw new TypeError(be(e, ...Se));
  if (Kt(e, t, "encrypt", "wrapKey"), La(t, e), e.usages.includes("encrypt"))
    return new Uint8Array(await M.subtle.encrypt(ua(t), e, r));
  if (e.usages.includes("wrapKey")) {
    const n = await M.subtle.importKey("raw", r, ...xa);
    return new Uint8Array(await M.subtle.wrapKey("raw", n, e, ua(t)));
  }
  throw new TypeError('RSA-OAEP key "usages" must include "encrypt" or "wrapKey" for this operation');
}, jm = async (t, e, r) => {
  if (!Oe(e))
    throw new TypeError(be(e, ...Se));
  if (Kt(e, t, "decrypt", "unwrapKey"), La(t, e), e.usages.includes("decrypt"))
    return new Uint8Array(await M.subtle.decrypt(ua(t), e, r));
  if (e.usages.includes("unwrapKey")) {
    const n = await M.subtle.unwrapKey("raw", r, e, ua(t), ...xa);
    return new Uint8Array(await M.subtle.exportKey("raw", n));
  }
  throw new TypeError('RSA-OAEP key "usages" must include "decrypt" or "unwrapKey" for this operation');
};
function Or(t) {
  return re(t) && typeof t.kty == "string";
}
function Dm(t) {
  return t.kty !== "oct" && typeof t.d == "string";
}
function zm(t) {
  return t.kty !== "oct" && typeof t.d > "u";
}
function $m(t) {
  return Or(t) && t.kty === "oct" && typeof t.k == "string";
}
function Mm(t) {
  let e, r;
  switch (t.kty) {
    case "RSA": {
      switch (t.alg) {
        case "PS256":
        case "PS384":
        case "PS512":
          e = { name: "RSA-PSS", hash: `SHA-${t.alg.slice(-3)}` }, r = t.d ? ["sign"] : ["verify"];
          break;
        case "RS256":
        case "RS384":
        case "RS512":
          e = { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${t.alg.slice(-3)}` }, r = t.d ? ["sign"] : ["verify"];
          break;
        case "RSA-OAEP":
        case "RSA-OAEP-256":
        case "RSA-OAEP-384":
        case "RSA-OAEP-512":
          e = {
            name: "RSA-OAEP",
            hash: `SHA-${parseInt(t.alg.slice(-3), 10) || 1}`
          }, r = t.d ? ["decrypt", "unwrapKey"] : ["encrypt", "wrapKey"];
          break;
        default:
          throw new x('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "EC": {
      switch (t.alg) {
        case "ES256":
          e = { name: "ECDSA", namedCurve: "P-256" }, r = t.d ? ["sign"] : ["verify"];
          break;
        case "ES384":
          e = { name: "ECDSA", namedCurve: "P-384" }, r = t.d ? ["sign"] : ["verify"];
          break;
        case "ES512":
          e = { name: "ECDSA", namedCurve: "P-521" }, r = t.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          e = { name: "ECDH", namedCurve: t.crv }, r = t.d ? ["deriveBits"] : [];
          break;
        default:
          throw new x('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "OKP": {
      switch (t.alg) {
        case "Ed25519":
          e = { name: "Ed25519" }, r = t.d ? ["sign"] : ["verify"];
          break;
        case "EdDSA":
          e = { name: t.crv }, r = t.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          e = { name: t.crv }, r = t.d ? ["deriveBits"] : [];
          break;
        default:
          throw new x('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    default:
      throw new x('Invalid or unsupported JWK "kty" (Key Type) Parameter value');
  }
  return { algorithm: e, keyUsages: r };
}
const Ku = async (t) => {
  if (!t.alg)
    throw new TypeError('"alg" argument is required when "jwk.alg" is not present');
  const { algorithm: e, keyUsages: r } = Mm(t), n = [
    e,
    t.ext ?? !1,
    t.key_ops ?? r
  ], s = { ...t };
  return delete s.alg, delete s.use, M.subtle.importKey("jwk", s, ...n);
}, xu = (t) => ee(t);
let dr, ur;
const Lu = (t) => (t == null ? void 0 : t[Symbol.toStringTag]) === "KeyObject", la = async (t, e, r, n, s = !1) => {
  let a = t.get(e);
  if (a != null && a[n])
    return a[n];
  const o = await Ku({ ...r, alg: n });
  return s && Object.freeze(e), a ? a[n] = o : t.set(e, { [n]: o }), o;
}, Um = (t, e) => {
  if (Lu(t)) {
    let r = t.export({ format: "jwk" });
    return delete r.d, delete r.dp, delete r.dq, delete r.p, delete r.q, delete r.qi, r.k ? xu(r.k) : (ur || (ur = /* @__PURE__ */ new WeakMap()), la(ur, t, r, e));
  }
  return Or(t) ? t.k ? ee(t.k) : (ur || (ur = /* @__PURE__ */ new WeakMap()), la(ur, t, t, e, !0)) : t;
}, Km = (t, e) => {
  if (Lu(t)) {
    let r = t.export({ format: "jwk" });
    return r.k ? xu(r.k) : (dr || (dr = /* @__PURE__ */ new WeakMap()), la(dr, t, r, e));
  }
  return Or(t) ? t.k ? ee(t.k) : (dr || (dr = /* @__PURE__ */ new WeakMap()), la(dr, t, t, e, !0)) : t;
}, Dt = { normalizePublicKey: Um, normalizePrivateKey: Km };
function qi(t) {
  switch (t) {
    case "A128GCM":
      return 128;
    case "A192GCM":
      return 192;
    case "A256GCM":
    case "A128CBC-HS256":
      return 256;
    case "A192CBC-HS384":
      return 384;
    case "A256CBC-HS512":
      return 512;
    default:
      throw new x(`Unsupported JWE Algorithm: ${t}`);
  }
}
const Gt = (t) => Ka(new Uint8Array(qi(t) >> 3)), Nu = (t, e) => {
  const r = (t.match(/.{1,64}/g) || []).join(`
`);
  return `-----BEGIN ${e}-----
${r}
-----END ${e}-----`;
}, Wu = async (t, e, r) => {
  if (!Oe(r))
    throw new TypeError(be(r, ...Se));
  if (!r.extractable)
    throw new TypeError("CryptoKey is not extractable");
  if (r.type !== t)
    throw new TypeError(`key is not a ${t} key`);
  return Nu(Zi(new Uint8Array(await M.subtle.exportKey(e, r))), `${t.toUpperCase()} KEY`);
}, xm = (t) => Wu("public", "spki", t), Lm = (t) => Wu("private", "pkcs8", t), Pt = (t, e, r = 0) => {
  r === 0 && (e.unshift(e.length), e.unshift(6));
  const n = t.indexOf(e[0], r);
  if (n === -1)
    return !1;
  const s = t.subarray(n, n + e.length);
  return s.length !== e.length ? !1 : s.every((a, o) => a === e[o]) || Pt(t, e, n + 1);
}, Bc = (t) => {
  switch (!0) {
    case Pt(t, [42, 134, 72, 206, 61, 3, 1, 7]):
      return "P-256";
    case Pt(t, [43, 129, 4, 0, 34]):
      return "P-384";
    case Pt(t, [43, 129, 4, 0, 35]):
      return "P-521";
    case Pt(t, [43, 101, 110]):
      return "X25519";
    case Pt(t, [43, 101, 111]):
      return "X448";
    case Pt(t, [43, 101, 112]):
      return "Ed25519";
    case Pt(t, [43, 101, 113]):
      return "Ed448";
    default:
      throw new x("Invalid or unsupported EC Key Curve or OKP Key Sub Type");
  }
}, Hu = async (t, e, r, n, s) => {
  let a, o;
  const i = new Uint8Array(atob(r.replace(t, "")).split("").map((d) => d.charCodeAt(0))), c = e === "spki";
  switch (n) {
    case "PS256":
    case "PS384":
    case "PS512":
      a = { name: "RSA-PSS", hash: `SHA-${n.slice(-3)}` }, o = c ? ["verify"] : ["sign"];
      break;
    case "RS256":
    case "RS384":
    case "RS512":
      a = { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${n.slice(-3)}` }, o = c ? ["verify"] : ["sign"];
      break;
    case "RSA-OAEP":
    case "RSA-OAEP-256":
    case "RSA-OAEP-384":
    case "RSA-OAEP-512":
      a = {
        name: "RSA-OAEP",
        hash: `SHA-${parseInt(n.slice(-3), 10) || 1}`
      }, o = c ? ["encrypt", "wrapKey"] : ["decrypt", "unwrapKey"];
      break;
    case "ES256":
      a = { name: "ECDSA", namedCurve: "P-256" }, o = c ? ["verify"] : ["sign"];
      break;
    case "ES384":
      a = { name: "ECDSA", namedCurve: "P-384" }, o = c ? ["verify"] : ["sign"];
      break;
    case "ES512":
      a = { name: "ECDSA", namedCurve: "P-521" }, o = c ? ["verify"] : ["sign"];
      break;
    case "ECDH-ES":
    case "ECDH-ES+A128KW":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A256KW": {
      const d = Bc(i);
      a = d.startsWith("P-") ? { name: "ECDH", namedCurve: d } : { name: d }, o = c ? [] : ["deriveBits"];
      break;
    }
    case "Ed25519":
      a = { name: "Ed25519" }, o = c ? ["verify"] : ["sign"];
      break;
    case "EdDSA":
      a = { name: Bc(i) }, o = c ? ["verify"] : ["sign"];
      break;
    default:
      throw new x('Invalid or unsupported "alg" (Algorithm) value');
  }
  return M.subtle.importKey(e, i, a, (s == null ? void 0 : s.extractable) ?? !1, o);
}, Nm = (t, e, r) => Hu(/(?:-----(?:BEGIN|END) PRIVATE KEY-----|\s)/g, "pkcs8", t, e, r), Ju = (t, e, r) => Hu(/(?:-----(?:BEGIN|END) PUBLIC KEY-----|\s)/g, "spki", t, e, r);
function Vc(t) {
  const e = [];
  let r = 0;
  for (; r < t.length; ) {
    const n = Zu(t.subarray(r));
    e.push(n), r += n.byteLength;
  }
  return e;
}
function Zu(t) {
  let e = 0, r = t[0] & 31;
  if (e++, r === 31) {
    for (r = 0; t[e] >= 128; )
      r = r * 128 + t[e] - 128, e++;
    r = r * 128 + t[e] - 128, e++;
  }
  let n = 0;
  if (t[e] < 128)
    n = t[e], e++;
  else if (n === 128) {
    for (n = 0; t[e + n] !== 0 || t[e + n + 1] !== 0; ) {
      if (n > t.byteLength)
        throw new TypeError("invalid indefinite form length");
      n++;
    }
    const a = e + n + 2;
    return {
      byteLength: a,
      contents: t.subarray(e, e + n),
      raw: t.subarray(0, a)
    };
  } else {
    const a = t[e] & 127;
    e++, n = 0;
    for (let o = 0; o < a; o++)
      n = n * 256 + t[e], e++;
  }
  const s = e + n;
  return {
    byteLength: s,
    contents: t.subarray(e, s),
    raw: t.subarray(0, s)
  };
}
function Wm(t) {
  const e = Vc(Vc(Zu(t).contents)[0].contents);
  return Zi(e[e[0].raw[0] === 160 ? 6 : 5].raw);
}
function Hm(t) {
  const e = t.replace(/(?:-----(?:BEGIN|END) CERTIFICATE-----|\s)/g, ""), r = Pu(e);
  return Nu(Wm(r), "PUBLIC KEY");
}
const Jm = (t, e, r) => {
  let n;
  try {
    n = Hm(t);
  } catch (s) {
    throw new TypeError("Failed to parse the X.509 certificate", { cause: s });
  }
  return Ju(n, e, r);
};
async function Zm(t, e, r) {
  if (typeof t != "string" || t.indexOf("-----BEGIN PUBLIC KEY-----") !== 0)
    throw new TypeError('"spki" must be SPKI formatted string');
  return Ju(t, e, r);
}
async function Fm(t, e, r) {
  if (typeof t != "string" || t.indexOf("-----BEGIN CERTIFICATE-----") !== 0)
    throw new TypeError('"x509" must be X.509 formatted string');
  return Jm(t, e, r);
}
async function Bm(t, e, r) {
  if (typeof t != "string" || t.indexOf("-----BEGIN PRIVATE KEY-----") !== 0)
    throw new TypeError('"pkcs8" must be PKCS#8 formatted string');
  return Nm(t, e, r);
}
async function $n(t, e) {
  if (!re(t))
    throw new TypeError("JWK must be an object");
  switch (e || (e = t.alg), t.kty) {
    case "oct":
      if (typeof t.k != "string" || !t.k)
        throw new TypeError('missing "k" (Key Value) Parameter value');
      return ee(t.k);
    case "RSA":
      if ("oth" in t && t.oth !== void 0)
        throw new x('RSA JWK "oth" (Other Primes Info) Parameter value is not supported');
    case "EC":
    case "OKP":
      return Ku({ ...t, alg: e });
    default:
      throw new x('Unsupported "kty" (Key Type) Parameter value');
  }
}
const pr = (t) => t == null ? void 0 : t[Symbol.toStringTag], wi = (t, e, r) => {
  var n, s;
  if (e.use !== void 0 && e.use !== "sig")
    throw new TypeError("Invalid key for this operation, when present its use must be sig");
  if (e.key_ops !== void 0 && ((s = (n = e.key_ops).includes) == null ? void 0 : s.call(n, r)) !== !0)
    throw new TypeError(`Invalid key for this operation, when present its key_ops must include ${r}`);
  if (e.alg !== void 0 && e.alg !== t)
    throw new TypeError(`Invalid key for this operation, when present its alg must be ${t}`);
  return !0;
}, Vm = (t, e, r, n) => {
  if (!(e instanceof Uint8Array)) {
    if (n && Or(e)) {
      if ($m(e) && wi(t, e, r))
        return;
      throw new TypeError('JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present');
    }
    if (!ku(e))
      throw new TypeError(Ru(t, e, ...Se, "Uint8Array", n ? "JSON Web Key" : null));
    if (e.type !== "secret")
      throw new TypeError(`${pr(e)} instances for symmetric algorithms must be of type "secret"`);
  }
}, qm = (t, e, r, n) => {
  if (n && Or(e))
    switch (r) {
      case "sign":
        if (Dm(e) && wi(t, e, r))
          return;
        throw new TypeError("JSON Web Key for this operation be a private JWK");
      case "verify":
        if (zm(e) && wi(t, e, r))
          return;
        throw new TypeError("JSON Web Key for this operation be a public JWK");
    }
  if (!ku(e))
    throw new TypeError(Ru(t, e, ...Se, n ? "JSON Web Key" : null));
  if (e.type === "secret")
    throw new TypeError(`${pr(e)} instances for asymmetric algorithms must not be of type "secret"`);
  if (r === "sign" && e.type === "public")
    throw new TypeError(`${pr(e)} instances for asymmetric algorithm signing must be of type "private"`);
  if (r === "decrypt" && e.type === "public")
    throw new TypeError(`${pr(e)} instances for asymmetric algorithm decryption must be of type "private"`);
  if (e.algorithm && r === "verify" && e.type === "private")
    throw new TypeError(`${pr(e)} instances for asymmetric algorithm verifying must be of type "public"`);
  if (e.algorithm && r === "encrypt" && e.type === "private")
    throw new TypeError(`${pr(e)} instances for asymmetric algorithm encryption must be of type "public"`);
};
function Fu(t, e, r, n) {
  e.startsWith("HS") || e === "dir" || e.startsWith("PBES2") || /^A\d{3}(?:GCM)?KW$/.test(e) ? Vm(e, r, n, t) : qm(e, r, n, t);
}
const Bu = Fu.bind(void 0, !1), vi = Fu.bind(void 0, !0);
async function Gm(t, e, r, n, s) {
  if (!(r instanceof Uint8Array))
    throw new TypeError(be(r, "Uint8Array"));
  const a = parseInt(t.slice(1, 4), 10), o = await M.subtle.importKey("raw", r.subarray(a >> 3), "AES-CBC", !1, ["encrypt"]), i = await M.subtle.importKey("raw", r.subarray(0, a >> 3), {
    hash: `SHA-${a << 1}`,
    name: "HMAC"
  }, !1, ["sign"]), c = new Uint8Array(await M.subtle.encrypt({
    iv: n,
    name: "AES-CBC"
  }, o, e)), d = dt(s, n, c, Au(s.length << 3)), u = new Uint8Array((await M.subtle.sign("HMAC", i, d)).slice(0, a >> 3));
  return { ciphertext: c, tag: u, iv: n };
}
async function Ym(t, e, r, n, s) {
  let a;
  r instanceof Uint8Array ? a = await M.subtle.importKey("raw", r, "AES-GCM", !1, ["encrypt"]) : (Kt(r, t, "encrypt"), a = r);
  const o = new Uint8Array(await M.subtle.encrypt({
    additionalData: s,
    iv: n,
    name: "AES-GCM",
    tagLength: 128
  }, a, e)), i = o.slice(-16);
  return { ciphertext: o.slice(0, -16), tag: i, iv: n };
}
const Vu = async (t, e, r, n, s) => {
  if (!Oe(r) && !(r instanceof Uint8Array))
    throw new TypeError(be(r, ...Se, "Uint8Array"));
  switch (n ? Cu(t, n) : n = wm(t), t) {
    case "A128CBC-HS256":
    case "A192CBC-HS384":
    case "A256CBC-HS512":
      return r instanceof Uint8Array && da(r, parseInt(t.slice(-3), 10)), Gm(t, e, r, n, s);
    case "A128GCM":
    case "A192GCM":
    case "A256GCM":
      return r instanceof Uint8Array && da(r, parseInt(t.slice(1, 4), 10)), Ym(t, e, r, n, s);
    default:
      throw new x("Unsupported JWE Content Encryption Algorithm");
  }
};
async function Xm(t, e, r, n) {
  const s = t.slice(0, 7), a = await Vu(s, r, e, n, new Uint8Array(0));
  return {
    encryptedKey: a.ciphertext,
    iv: se(a.iv),
    tag: se(a.tag)
  };
}
async function Qm(t, e, r, n, s) {
  const a = t.slice(0, 7);
  return ju(a, e, r, n, s, new Uint8Array(0));
}
async function e_(t, e, r, n, s) {
  var a;
  switch (Bu(t, e, "decrypt"), e = await ((a = Dt.normalizePrivateKey) == null ? void 0 : a.call(Dt, e, t)) || e, t) {
    case "dir": {
      if (r !== void 0)
        throw new C("Encountered unexpected JWE Encrypted Key");
      return e;
    }
    case "ECDH-ES":
      if (r !== void 0)
        throw new C("Encountered unexpected JWE Encrypted Key");
    case "ECDH-ES+A128KW":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A256KW": {
      if (!re(n.epk))
        throw new C('JOSE Header "epk" (Ephemeral Public Key) missing or invalid');
      if (!Mu(e))
        throw new x("ECDH with the provided key is not allowed or not supported by your javascript runtime");
      const o = await $n(n.epk, t);
      let i, c;
      if (n.apu !== void 0) {
        if (typeof n.apu != "string")
          throw new C('JOSE Header "apu" (Agreement PartyUInfo) invalid');
        try {
          i = ee(n.apu);
        } catch {
          throw new C("Failed to base64url decode the apu");
        }
      }
      if (n.apv !== void 0) {
        if (typeof n.apv != "string")
          throw new C('JOSE Header "apv" (Agreement PartyVInfo) invalid');
        try {
          c = ee(n.apv);
        } catch {
          throw new C("Failed to base64url decode the apv");
        }
      }
      const d = await $u(o, e, t === "ECDH-ES" ? n.enc : t, t === "ECDH-ES" ? qi(n.enc) : parseInt(t.slice(-5, -2), 10), i, c);
      if (t === "ECDH-ES")
        return d;
      if (r === void 0)
        throw new C("JWE Encrypted Key missing");
      return gi(t.slice(-6), d, r);
    }
    case "RSA1_5":
    case "RSA-OAEP":
    case "RSA-OAEP-256":
    case "RSA-OAEP-384":
    case "RSA-OAEP-512": {
      if (r === void 0)
        throw new C("JWE Encrypted Key missing");
      return jm(t, e, r);
    }
    case "PBES2-HS256+A128KW":
    case "PBES2-HS384+A192KW":
    case "PBES2-HS512+A256KW": {
      if (r === void 0)
        throw new C("JWE Encrypted Key missing");
      if (typeof n.p2c != "number")
        throw new C('JOSE Header "p2c" (PBES2 Count) missing or invalid');
      const o = (s == null ? void 0 : s.maxPBES2Count) || 1e4;
      if (n.p2c > o)
        throw new C('JOSE Header "p2c" (PBES2 Count) out is of acceptable bounds');
      if (typeof n.p2s != "string")
        throw new C('JOSE Header "p2s" (PBES2 Salt) missing or invalid');
      let i;
      try {
        i = ee(n.p2s);
      } catch {
        throw new C("Failed to base64url decode the p2s");
      }
      return Rm(t, e, r, n.p2c, i);
    }
    case "A128KW":
    case "A192KW":
    case "A256KW": {
      if (r === void 0)
        throw new C("JWE Encrypted Key missing");
      return gi(t, e, r);
    }
    case "A128GCMKW":
    case "A192GCMKW":
    case "A256GCMKW": {
      if (r === void 0)
        throw new C("JWE Encrypted Key missing");
      if (typeof n.iv != "string")
        throw new C('JOSE Header "iv" (Initialization Vector) missing or invalid');
      if (typeof n.tag != "string")
        throw new C('JOSE Header "tag" (Authentication Tag) missing or invalid');
      let o;
      try {
        o = ee(n.iv);
      } catch {
        throw new C("Failed to base64url decode the iv");
      }
      let i;
      try {
        i = ee(n.tag);
      } catch {
        throw new C("Failed to base64url decode the tag");
      }
      return Qm(t, e, r, o, i);
    }
    default:
      throw new x('Invalid or unsupported "alg" (JWE Algorithm) header value');
  }
}
function Mn(t, e, r, n, s) {
  if (s.crit !== void 0 && (n == null ? void 0 : n.crit) === void 0)
    throw new t('"crit" (Critical) Header Parameter MUST be integrity protected');
  if (!n || n.crit === void 0)
    return /* @__PURE__ */ new Set();
  if (!Array.isArray(n.crit) || n.crit.length === 0 || n.crit.some((o) => typeof o != "string" || o.length === 0))
    throw new t('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
  let a;
  r !== void 0 ? a = new Map([...Object.entries(r), ...e.entries()]) : a = e;
  for (const o of n.crit) {
    if (!a.has(o))
      throw new x(`Extension Header Parameter "${o}" is not recognized`);
    if (s[o] === void 0)
      throw new t(`Extension Header Parameter "${o}" is missing`);
    if (a.get(o) && n[o] === void 0)
      throw new t(`Extension Header Parameter "${o}" MUST be integrity protected`);
  }
  return new Set(n.crit);
}
const bi = (t, e) => {
  if (e !== void 0 && (!Array.isArray(e) || e.some((r) => typeof r != "string")))
    throw new TypeError(`"${t}" option must be an array of strings`);
  if (e)
    return new Set(e);
};
async function Gi(t, e, r) {
  if (!re(t))
    throw new C("Flattened JWE must be an object");
  if (t.protected === void 0 && t.header === void 0 && t.unprotected === void 0)
    throw new C("JOSE Header missing");
  if (t.iv !== void 0 && typeof t.iv != "string")
    throw new C("JWE Initialization Vector incorrect type");
  if (typeof t.ciphertext != "string")
    throw new C("JWE Ciphertext missing or incorrect type");
  if (t.tag !== void 0 && typeof t.tag != "string")
    throw new C("JWE Authentication Tag incorrect type");
  if (t.protected !== void 0 && typeof t.protected != "string")
    throw new C("JWE Protected Header incorrect type");
  if (t.encrypted_key !== void 0 && typeof t.encrypted_key != "string")
    throw new C("JWE Encrypted Key incorrect type");
  if (t.aad !== void 0 && typeof t.aad != "string")
    throw new C("JWE AAD incorrect type");
  if (t.header !== void 0 && !re(t.header))
    throw new C("JWE Shared Unprotected Header incorrect type");
  if (t.unprotected !== void 0 && !re(t.unprotected))
    throw new C("JWE Per-Recipient Unprotected Header incorrect type");
  let n;
  if (t.protected)
    try {
      const D = ee(t.protected);
      n = JSON.parse(Ke.decode(D));
    } catch {
      throw new C("JWE Protected Header is invalid");
    }
  if (!zn(n, t.header, t.unprotected))
    throw new C("JWE Protected, JWE Unprotected Header, and JWE Per-Recipient Unprotected Header Parameter names must be disjoint");
  const s = {
    ...n,
    ...t.header,
    ...t.unprotected
  };
  if (Mn(C, /* @__PURE__ */ new Map(), r == null ? void 0 : r.crit, n, s), s.zip !== void 0)
    throw new x('JWE "zip" (Compression Algorithm) Header Parameter is not supported.');
  const { alg: a, enc: o } = s;
  if (typeof a != "string" || !a)
    throw new C("missing JWE Algorithm (alg) in JWE Header");
  if (typeof o != "string" || !o)
    throw new C("missing JWE Encryption Algorithm (enc) in JWE Header");
  const i = r && bi("keyManagementAlgorithms", r.keyManagementAlgorithms), c = r && bi("contentEncryptionAlgorithms", r.contentEncryptionAlgorithms);
  if (i && !i.has(a) || !i && a.startsWith("PBES2"))
    throw new Pn('"alg" (Algorithm) Header Parameter value not allowed');
  if (c && !c.has(o))
    throw new Pn('"enc" (Encryption Algorithm) Header Parameter value not allowed');
  let d;
  if (t.encrypted_key !== void 0)
    try {
      d = ee(t.encrypted_key);
    } catch {
      throw new C("Failed to base64url decode the encrypted_key");
    }
  let u = !1;
  typeof e == "function" && (e = await e(n, t), u = !0);
  let l;
  try {
    l = await e_(a, e, d, s, r);
  } catch (D) {
    if (D instanceof TypeError || D instanceof C || D instanceof x)
      throw D;
    l = Gt(o);
  }
  let p, f;
  if (t.iv !== void 0)
    try {
      p = ee(t.iv);
    } catch {
      throw new C("Failed to base64url decode the iv");
    }
  if (t.tag !== void 0)
    try {
      f = ee(t.tag);
    } catch {
      throw new C("Failed to base64url decode the tag");
    }
  const _ = te.encode(t.protected ?? "");
  let g;
  t.aad !== void 0 ? g = dt(_, te.encode("."), te.encode(t.aad)) : g = _;
  let S;
  try {
    S = ee(t.ciphertext);
  } catch {
    throw new C("Failed to base64url decode the ciphertext");
  }
  const b = { plaintext: await ju(o, l, S, p, f, g) };
  if (t.protected !== void 0 && (b.protectedHeader = n), t.aad !== void 0)
    try {
      b.additionalAuthenticatedData = ee(t.aad);
    } catch {
      throw new C("Failed to base64url decode the aad");
    }
  return t.unprotected !== void 0 && (b.sharedUnprotectedHeader = t.unprotected), t.header !== void 0 && (b.unprotectedHeader = t.header), u ? { ...b, key: e } : b;
}
async function qu(t, e, r) {
  if (t instanceof Uint8Array && (t = Ke.decode(t)), typeof t != "string")
    throw new C("Compact JWE must be a string or Uint8Array");
  const { 0: n, 1: s, 2: a, 3: o, 4: i, length: c } = t.split(".");
  if (c !== 5)
    throw new C("Invalid Compact JWE");
  const d = await Gi({
    ciphertext: o,
    iv: a || void 0,
    protected: n,
    tag: i || void 0,
    encrypted_key: s || void 0
  }, e, r), u = { plaintext: d.plaintext, protectedHeader: d.protectedHeader };
  return typeof e == "function" ? { ...u, key: d.key } : u;
}
async function t_(t, e, r) {
  if (!re(t))
    throw new C("General JWE must be an object");
  if (!Array.isArray(t.recipients) || !t.recipients.every(re))
    throw new C("JWE Recipients missing or incorrect type");
  if (!t.recipients.length)
    throw new C("JWE Recipients has no members");
  for (const n of t.recipients)
    try {
      return await Gi({
        aad: t.aad,
        ciphertext: t.ciphertext,
        encrypted_key: n.encrypted_key,
        header: n.header,
        iv: t.iv,
        protected: t.protected,
        tag: t.tag,
        unprotected: t.unprotected
      }, e, r);
    } catch {
    }
  throw new Pr();
}
const Gu = Symbol(), r_ = async (t) => {
  if (t instanceof Uint8Array)
    return {
      kty: "oct",
      k: se(t)
    };
  if (!Oe(t))
    throw new TypeError(be(t, ...Se, "Uint8Array"));
  if (!t.extractable)
    throw new TypeError("non-extractable CryptoKey cannot be exported as a JWK");
  const { ext: e, key_ops: r, alg: n, use: s, ...a } = await M.subtle.exportKey("jwk", t);
  return a;
};
async function n_(t) {
  return xm(t);
}
async function s_(t) {
  return Lm(t);
}
async function Yu(t) {
  return r_(t);
}
async function Xu(t, e, r, n, s = {}) {
  var c;
  let a, o, i;
  switch (Bu(t, r, "encrypt"), r = await ((c = Dt.normalizePublicKey) == null ? void 0 : c.call(Dt, r, t)) || r, t) {
    case "dir": {
      i = r;
      break;
    }
    case "ECDH-ES":
    case "ECDH-ES+A128KW":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A256KW": {
      if (!Mu(r))
        throw new x("ECDH with the provided key is not allowed or not supported by your javascript runtime");
      const { apu: d, apv: u } = s;
      let { epk: l } = s;
      l || (l = (await Im(r)).privateKey);
      const { x: p, y: f, crv: _, kty: g } = await Yu(l), S = await $u(r, l, t === "ECDH-ES" ? e : t, t === "ECDH-ES" ? qi(e) : parseInt(t.slice(-5, -2), 10), d, u);
      if (o = { epk: { x: p, crv: _, kty: g } }, g === "EC" && (o.epk.y = f), d && (o.apu = se(d)), u && (o.apv = se(u)), t === "ECDH-ES") {
        i = S;
        break;
      }
      i = n || Gt(e);
      const w = t.slice(-6);
      a = await _i(w, S, i);
      break;
    }
    case "RSA1_5":
    case "RSA-OAEP":
    case "RSA-OAEP-256":
    case "RSA-OAEP-384":
    case "RSA-OAEP-512": {
      i = n || Gt(e), a = await km(t, r, i);
      break;
    }
    case "PBES2-HS256+A128KW":
    case "PBES2-HS384+A192KW":
    case "PBES2-HS512+A256KW": {
      i = n || Gt(e);
      const { p2c: d, p2s: u } = s;
      ({ encryptedKey: a, ...o } = await Tm(t, r, i, d, u));
      break;
    }
    case "A128KW":
    case "A192KW":
    case "A256KW": {
      i = n || Gt(e), a = await _i(t, r, i);
      break;
    }
    case "A128GCMKW":
    case "A192GCMKW":
    case "A256GCMKW": {
      i = n || Gt(e);
      const { iv: d } = s;
      ({ encryptedKey: a, ...o } = await Xm(t, r, i, d));
      break;
    }
    default:
      throw new x('Invalid or unsupported "alg" (JWE Algorithm) header value');
  }
  return { cek: i, encryptedKey: a, parameters: o };
}
class ha {
  constructor(e) {
    if (!(e instanceof Uint8Array))
      throw new TypeError("plaintext must be an instance of Uint8Array");
    this._plaintext = e;
  }
  setKeyManagementParameters(e) {
    if (this._keyManagementParameters)
      throw new TypeError("setKeyManagementParameters can only be called once");
    return this._keyManagementParameters = e, this;
  }
  setProtectedHeader(e) {
    if (this._protectedHeader)
      throw new TypeError("setProtectedHeader can only be called once");
    return this._protectedHeader = e, this;
  }
  setSharedUnprotectedHeader(e) {
    if (this._sharedUnprotectedHeader)
      throw new TypeError("setSharedUnprotectedHeader can only be called once");
    return this._sharedUnprotectedHeader = e, this;
  }
  setUnprotectedHeader(e) {
    if (this._unprotectedHeader)
      throw new TypeError("setUnprotectedHeader can only be called once");
    return this._unprotectedHeader = e, this;
  }
  setAdditionalAuthenticatedData(e) {
    return this._aad = e, this;
  }
  setContentEncryptionKey(e) {
    if (this._cek)
      throw new TypeError("setContentEncryptionKey can only be called once");
    return this._cek = e, this;
  }
  setInitializationVector(e) {
    if (this._iv)
      throw new TypeError("setInitializationVector can only be called once");
    return this._iv = e, this;
  }
  async encrypt(e, r) {
    if (!this._protectedHeader && !this._unprotectedHeader && !this._sharedUnprotectedHeader)
      throw new C("either setProtectedHeader, setUnprotectedHeader, or sharedUnprotectedHeader must be called before #encrypt()");
    if (!zn(this._protectedHeader, this._unprotectedHeader, this._sharedUnprotectedHeader))
      throw new C("JWE Protected, JWE Shared Unprotected and JWE Per-Recipient Header Parameter names must be disjoint");
    const n = {
      ...this._protectedHeader,
      ...this._unprotectedHeader,
      ...this._sharedUnprotectedHeader
    };
    if (Mn(C, /* @__PURE__ */ new Map(), r == null ? void 0 : r.crit, this._protectedHeader, n), n.zip !== void 0)
      throw new x('JWE "zip" (Compression Algorithm) Header Parameter is not supported.');
    const { alg: s, enc: a } = n;
    if (typeof s != "string" || !s)
      throw new C('JWE "alg" (Algorithm) Header Parameter missing or invalid');
    if (typeof a != "string" || !a)
      throw new C('JWE "enc" (Encryption Algorithm) Header Parameter missing or invalid');
    let o;
    if (this._cek && (s === "dir" || s === "ECDH-ES"))
      throw new TypeError(`setContentEncryptionKey cannot be called with JWE "alg" (Algorithm) Header ${s}`);
    let i;
    {
      let g;
      ({ cek: i, encryptedKey: o, parameters: g } = await Xu(s, a, e, this._cek, this._keyManagementParameters)), g && (r && Gu in r ? this._unprotectedHeader ? this._unprotectedHeader = { ...this._unprotectedHeader, ...g } : this.setUnprotectedHeader(g) : this._protectedHeader ? this._protectedHeader = { ...this._protectedHeader, ...g } : this.setProtectedHeader(g));
    }
    let c, d, u;
    this._protectedHeader ? d = te.encode(se(JSON.stringify(this._protectedHeader))) : d = te.encode(""), this._aad ? (u = se(this._aad), c = dt(d, te.encode("."), te.encode(u))) : c = d;
    const { ciphertext: l, tag: p, iv: f } = await Vu(a, this._plaintext, i, this._iv, c), _ = {
      ciphertext: se(l)
    };
    return f && (_.iv = se(f)), p && (_.tag = se(p)), o && (_.encrypted_key = se(o)), u && (_.aad = u), this._protectedHeader && (_.protected = Ke.decode(d)), this._sharedUnprotectedHeader && (_.unprotected = this._sharedUnprotectedHeader), this._unprotectedHeader && (_.header = this._unprotectedHeader), _;
  }
}
class a_ {
  constructor(e, r, n) {
    this.parent = e, this.key = r, this.options = n;
  }
  setUnprotectedHeader(e) {
    if (this.unprotectedHeader)
      throw new TypeError("setUnprotectedHeader can only be called once");
    return this.unprotectedHeader = e, this;
  }
  addRecipient(...e) {
    return this.parent.addRecipient(...e);
  }
  encrypt(...e) {
    return this.parent.encrypt(...e);
  }
  done() {
    return this.parent;
  }
}
class o_ {
  constructor(e) {
    this._recipients = [], this._plaintext = e;
  }
  addRecipient(e, r) {
    const n = new a_(this, e, { crit: r == null ? void 0 : r.crit });
    return this._recipients.push(n), n;
  }
  setProtectedHeader(e) {
    if (this._protectedHeader)
      throw new TypeError("setProtectedHeader can only be called once");
    return this._protectedHeader = e, this;
  }
  setSharedUnprotectedHeader(e) {
    if (this._unprotectedHeader)
      throw new TypeError("setSharedUnprotectedHeader can only be called once");
    return this._unprotectedHeader = e, this;
  }
  setAdditionalAuthenticatedData(e) {
    return this._aad = e, this;
  }
  async encrypt() {
    var s, a, o;
    if (!this._recipients.length)
      throw new C("at least one recipient must be added");
    if (this._recipients.length === 1) {
      const [i] = this._recipients, c = await new ha(this._plaintext).setAdditionalAuthenticatedData(this._aad).setProtectedHeader(this._protectedHeader).setSharedUnprotectedHeader(this._unprotectedHeader).setUnprotectedHeader(i.unprotectedHeader).encrypt(i.key, { ...i.options }), d = {
        ciphertext: c.ciphertext,
        iv: c.iv,
        recipients: [{}],
        tag: c.tag
      };
      return c.aad && (d.aad = c.aad), c.protected && (d.protected = c.protected), c.unprotected && (d.unprotected = c.unprotected), c.encrypted_key && (d.recipients[0].encrypted_key = c.encrypted_key), c.header && (d.recipients[0].header = c.header), d;
    }
    let e;
    for (let i = 0; i < this._recipients.length; i++) {
      const c = this._recipients[i];
      if (!zn(this._protectedHeader, this._unprotectedHeader, c.unprotectedHeader))
        throw new C("JWE Protected, JWE Shared Unprotected and JWE Per-Recipient Header Parameter names must be disjoint");
      const d = {
        ...this._protectedHeader,
        ...this._unprotectedHeader,
        ...c.unprotectedHeader
      }, { alg: u } = d;
      if (typeof u != "string" || !u)
        throw new C('JWE "alg" (Algorithm) Header Parameter missing or invalid');
      if (u === "dir" || u === "ECDH-ES")
        throw new C('"dir" and "ECDH-ES" alg may only be used with a single recipient');
      if (typeof d.enc != "string" || !d.enc)
        throw new C('JWE "enc" (Encryption Algorithm) Header Parameter missing or invalid');
      if (!e)
        e = d.enc;
      else if (e !== d.enc)
        throw new C('JWE "enc" (Encryption Algorithm) Header Parameter must be the same for all recipients');
      if (Mn(C, /* @__PURE__ */ new Map(), c.options.crit, this._protectedHeader, d), d.zip !== void 0)
        throw new x('JWE "zip" (Compression Algorithm) Header Parameter is not supported.');
    }
    const r = Gt(e), n = {
      ciphertext: "",
      iv: "",
      recipients: [],
      tag: ""
    };
    for (let i = 0; i < this._recipients.length; i++) {
      const c = this._recipients[i], d = {};
      n.recipients.push(d);
      const l = {
        ...this._protectedHeader,
        ...this._unprotectedHeader,
        ...c.unprotectedHeader
      }.alg.startsWith("PBES2") ? 2048 + i : void 0;
      if (i === 0) {
        const _ = await new ha(this._plaintext).setAdditionalAuthenticatedData(this._aad).setContentEncryptionKey(r).setProtectedHeader(this._protectedHeader).setSharedUnprotectedHeader(this._unprotectedHeader).setUnprotectedHeader(c.unprotectedHeader).setKeyManagementParameters({ p2c: l }).encrypt(c.key, {
          ...c.options,
          [Gu]: !0
        });
        n.ciphertext = _.ciphertext, n.iv = _.iv, n.tag = _.tag, _.aad && (n.aad = _.aad), _.protected && (n.protected = _.protected), _.unprotected && (n.unprotected = _.unprotected), d.encrypted_key = _.encrypted_key, _.header && (d.header = _.header);
        continue;
      }
      const { encryptedKey: p, parameters: f } = await Xu(((s = c.unprotectedHeader) == null ? void 0 : s.alg) || ((a = this._protectedHeader) == null ? void 0 : a.alg) || ((o = this._unprotectedHeader) == null ? void 0 : o.alg), e, c.key, r, { p2c: l });
      d.encrypted_key = se(p), (c.unprotectedHeader || f) && (d.header = { ...c.unprotectedHeader, ...f });
    }
    return n;
  }
}
function Qu(t, e) {
  const r = `SHA-${t.slice(-3)}`;
  switch (t) {
    case "HS256":
    case "HS384":
    case "HS512":
      return { hash: r, name: "HMAC" };
    case "PS256":
    case "PS384":
    case "PS512":
      return { hash: r, name: "RSA-PSS", saltLength: t.slice(-3) >> 3 };
    case "RS256":
    case "RS384":
    case "RS512":
      return { hash: r, name: "RSASSA-PKCS1-v1_5" };
    case "ES256":
    case "ES384":
    case "ES512":
      return { hash: r, name: "ECDSA", namedCurve: e.namedCurve };
    case "Ed25519":
      return { name: "Ed25519" };
    case "EdDSA":
      return { name: e.name };
    default:
      throw new x(`alg ${t} is not supported either by JOSE or your javascript runtime`);
  }
}
async function el(t, e, r) {
  if (r === "sign" && (e = await Dt.normalizePrivateKey(e, t)), r === "verify" && (e = await Dt.normalizePublicKey(e, t)), Oe(e))
    return Sm(e, t, r), e;
  if (e instanceof Uint8Array) {
    if (!t.startsWith("HS"))
      throw new TypeError(be(e, ...Se));
    return M.subtle.importKey("raw", e, { hash: `SHA-${t.slice(-3)}`, name: "HMAC" }, !1, [r]);
  }
  throw new TypeError(be(e, ...Se, "Uint8Array", "JSON Web Key"));
}
const i_ = async (t, e, r, n) => {
  const s = await el(t, e, "verify");
  La(t, s);
  const a = Qu(t, s.algorithm);
  try {
    return await M.subtle.verify(a, s, r, n);
  } catch {
    return !1;
  }
};
async function Yi(t, e, r) {
  if (!re(t))
    throw new L("Flattened JWS must be an object");
  if (t.protected === void 0 && t.header === void 0)
    throw new L('Flattened JWS must have either of the "protected" or "header" members');
  if (t.protected !== void 0 && typeof t.protected != "string")
    throw new L("JWS Protected Header incorrect type");
  if (t.payload === void 0)
    throw new L("JWS Payload missing");
  if (typeof t.signature != "string")
    throw new L("JWS Signature missing or incorrect type");
  if (t.header !== void 0 && !re(t.header))
    throw new L("JWS Unprotected Header incorrect type");
  let n = {};
  if (t.protected)
    try {
      const g = ee(t.protected);
      n = JSON.parse(Ke.decode(g));
    } catch {
      throw new L("JWS Protected Header is invalid");
    }
  if (!zn(n, t.header))
    throw new L("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  const s = {
    ...n,
    ...t.header
  }, a = Mn(L, /* @__PURE__ */ new Map([["b64", !0]]), r == null ? void 0 : r.crit, n, s);
  let o = !0;
  if (a.has("b64") && (o = n.b64, typeof o != "boolean"))
    throw new L('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
  const { alg: i } = s;
  if (typeof i != "string" || !i)
    throw new L('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  const c = r && bi("algorithms", r.algorithms);
  if (c && !c.has(i))
    throw new Pn('"alg" (Algorithm) Header Parameter value not allowed');
  if (o) {
    if (typeof t.payload != "string")
      throw new L("JWS Payload must be a string");
  } else if (typeof t.payload != "string" && !(t.payload instanceof Uint8Array))
    throw new L("JWS Payload must be a string or an Uint8Array instance");
  let d = !1;
  typeof e == "function" ? (e = await e(n, t), d = !0, vi(i, e, "verify"), Or(e) && (e = await $n(e, i))) : vi(i, e, "verify");
  const u = dt(te.encode(t.protected ?? ""), te.encode("."), typeof t.payload == "string" ? te.encode(t.payload) : t.payload);
  let l;
  try {
    l = ee(t.signature);
  } catch {
    throw new L("Failed to base64url decode the signature");
  }
  if (!await i_(i, e, l, u))
    throw new Ua();
  let f;
  if (o)
    try {
      f = ee(t.payload);
    } catch {
      throw new L("Failed to base64url decode the payload");
    }
  else typeof t.payload == "string" ? f = te.encode(t.payload) : f = t.payload;
  const _ = { payload: f };
  return t.protected !== void 0 && (_.protectedHeader = n), t.header !== void 0 && (_.unprotectedHeader = t.header), d ? { ..._, key: e } : _;
}
async function tl(t, e, r) {
  if (t instanceof Uint8Array && (t = Ke.decode(t)), typeof t != "string")
    throw new L("Compact JWS must be a string or Uint8Array");
  const { 0: n, 1: s, 2: a, length: o } = t.split(".");
  if (o !== 3)
    throw new L("Invalid Compact JWS");
  const i = await Yi({ payload: s, protected: n, signature: a }, e, r), c = { payload: i.payload, protectedHeader: i.protectedHeader };
  return typeof e == "function" ? { ...c, key: i.key } : c;
}
async function c_(t, e, r) {
  if (!re(t))
    throw new L("General JWS must be an object");
  if (!Array.isArray(t.signatures) || !t.signatures.every(re))
    throw new L("JWS Signatures missing or incorrect type");
  for (const n of t.signatures)
    try {
      return await Yi({
        header: n.header,
        payload: t.payload,
        protected: n.protected,
        signature: n.signature
      }, e, r);
    } catch {
    }
  throw new Ua();
}
const It = (t) => Math.floor(t.getTime() / 1e3), rl = 60, nl = rl * 60, Xi = nl * 24, d_ = Xi * 7, u_ = Xi * 365.25, l_ = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i, dn = (t) => {
  const e = l_.exec(t);
  if (!e || e[4] && e[1])
    throw new TypeError("Invalid time period format");
  const r = parseFloat(e[2]), n = e[3].toLowerCase();
  let s;
  switch (n) {
    case "sec":
    case "secs":
    case "second":
    case "seconds":
    case "s":
      s = Math.round(r);
      break;
    case "minute":
    case "minutes":
    case "min":
    case "mins":
    case "m":
      s = Math.round(r * rl);
      break;
    case "hour":
    case "hours":
    case "hr":
    case "hrs":
    case "h":
      s = Math.round(r * nl);
      break;
    case "day":
    case "days":
    case "d":
      s = Math.round(r * Xi);
      break;
    case "week":
    case "weeks":
    case "w":
      s = Math.round(r * d_);
      break;
    default:
      s = Math.round(r * u_);
      break;
  }
  return e[1] === "-" || e[4] === "ago" ? -s : s;
}, qc = (t) => t.toLowerCase().replace(/^application\//, ""), h_ = (t, e) => typeof t == "string" ? e.includes(t) : Array.isArray(t) ? e.some(Set.prototype.has.bind(new Set(t))) : !1, Qi = (t, e, r = {}) => {
  let n;
  try {
    n = JSON.parse(Ke.decode(e));
  } catch {
  }
  if (!re(n))
    throw new Ie("JWT Claims Set must be a top-level JSON object");
  const { typ: s } = r;
  if (s && (typeof t.typ != "string" || qc(t.typ) !== qc(s)))
    throw new Pe('unexpected "typ" JWT header value', n, "typ", "check_failed");
  const { requiredClaims: a = [], issuer: o, subject: i, audience: c, maxTokenAge: d } = r, u = [...a];
  d !== void 0 && u.push("iat"), c !== void 0 && u.push("aud"), i !== void 0 && u.push("sub"), o !== void 0 && u.push("iss");
  for (const _ of new Set(u.reverse()))
    if (!(_ in n))
      throw new Pe(`missing required "${_}" claim`, n, _, "missing");
  if (o && !(Array.isArray(o) ? o : [o]).includes(n.iss))
    throw new Pe('unexpected "iss" claim value', n, "iss", "check_failed");
  if (i && n.sub !== i)
    throw new Pe('unexpected "sub" claim value', n, "sub", "check_failed");
  if (c && !h_(n.aud, typeof c == "string" ? [c] : c))
    throw new Pe('unexpected "aud" claim value', n, "aud", "check_failed");
  let l;
  switch (typeof r.clockTolerance) {
    case "string":
      l = dn(r.clockTolerance);
      break;
    case "number":
      l = r.clockTolerance;
      break;
    case "undefined":
      l = 0;
      break;
    default:
      throw new TypeError("Invalid clockTolerance option type");
  }
  const { currentDate: p } = r, f = It(p || /* @__PURE__ */ new Date());
  if ((n.iat !== void 0 || d) && typeof n.iat != "number")
    throw new Pe('"iat" claim must be a number', n, "iat", "invalid");
  if (n.nbf !== void 0) {
    if (typeof n.nbf != "number")
      throw new Pe('"nbf" claim must be a number', n, "nbf", "invalid");
    if (n.nbf > f + l)
      throw new Pe('"nbf" claim timestamp check failed', n, "nbf", "check_failed");
  }
  if (n.exp !== void 0) {
    if (typeof n.exp != "number")
      throw new Pe('"exp" claim must be a number', n, "exp", "invalid");
    if (n.exp <= f - l)
      throw new ca('"exp" claim timestamp check failed', n, "exp", "check_failed");
  }
  if (d) {
    const _ = f - n.iat, g = typeof d == "number" ? d : dn(d);
    if (_ - l > g)
      throw new ca('"iat" claim timestamp check failed (too far in the past)', n, "iat", "check_failed");
    if (_ < 0 - l)
      throw new Pe('"iat" claim timestamp check failed (it should be in the past)', n, "iat", "check_failed");
  }
  return n;
};
async function f_(t, e, r) {
  var o;
  const n = await tl(t, e, r);
  if ((o = n.protectedHeader.crit) != null && o.includes("b64") && n.protectedHeader.b64 === !1)
    throw new Ie("JWTs MUST NOT use unencoded payload");
  const a = { payload: Qi(n.protectedHeader, n.payload, r), protectedHeader: n.protectedHeader };
  return typeof e == "function" ? { ...a, key: n.key } : a;
}
async function p_(t, e, r) {
  const n = await qu(t, e, r), s = Qi(n.protectedHeader, n.plaintext, r), { protectedHeader: a } = n;
  if (a.iss !== void 0 && a.iss !== s.iss)
    throw new Pe('replicated "iss" claim header parameter mismatch', s, "iss", "mismatch");
  if (a.sub !== void 0 && a.sub !== s.sub)
    throw new Pe('replicated "sub" claim header parameter mismatch', s, "sub", "mismatch");
  if (a.aud !== void 0 && JSON.stringify(a.aud) !== JSON.stringify(s.aud))
    throw new Pe('replicated "aud" claim header parameter mismatch', s, "aud", "mismatch");
  const o = { payload: s, protectedHeader: a };
  return typeof e == "function" ? { ...o, key: n.key } : o;
}
class sl {
  constructor(e) {
    this._flattened = new ha(e);
  }
  setContentEncryptionKey(e) {
    return this._flattened.setContentEncryptionKey(e), this;
  }
  setInitializationVector(e) {
    return this._flattened.setInitializationVector(e), this;
  }
  setProtectedHeader(e) {
    return this._flattened.setProtectedHeader(e), this;
  }
  setKeyManagementParameters(e) {
    return this._flattened.setKeyManagementParameters(e), this;
  }
  async encrypt(e, r) {
    const n = await this._flattened.encrypt(e, r);
    return [n.protected, n.encrypted_key, n.iv, n.ciphertext, n.tag].join(".");
  }
}
const y_ = async (t, e, r) => {
  const n = await el(t, e, "sign");
  La(t, n);
  const s = await M.subtle.sign(Qu(t, n.algorithm), n, r);
  return new Uint8Array(s);
};
class ec {
  constructor(e) {
    if (!(e instanceof Uint8Array))
      throw new TypeError("payload must be an instance of Uint8Array");
    this._payload = e;
  }
  setProtectedHeader(e) {
    if (this._protectedHeader)
      throw new TypeError("setProtectedHeader can only be called once");
    return this._protectedHeader = e, this;
  }
  setUnprotectedHeader(e) {
    if (this._unprotectedHeader)
      throw new TypeError("setUnprotectedHeader can only be called once");
    return this._unprotectedHeader = e, this;
  }
  async sign(e, r) {
    if (!this._protectedHeader && !this._unprotectedHeader)
      throw new L("either setProtectedHeader or setUnprotectedHeader must be called before #sign()");
    if (!zn(this._protectedHeader, this._unprotectedHeader))
      throw new L("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
    const n = {
      ...this._protectedHeader,
      ...this._unprotectedHeader
    }, s = Mn(L, /* @__PURE__ */ new Map([["b64", !0]]), r == null ? void 0 : r.crit, this._protectedHeader, n);
    let a = !0;
    if (s.has("b64") && (a = this._protectedHeader.b64, typeof a != "boolean"))
      throw new L('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
    const { alg: o } = n;
    if (typeof o != "string" || !o)
      throw new L('JWS "alg" (Algorithm) Header Parameter missing or invalid');
    vi(o, e, "sign");
    let i = this._payload;
    a && (i = te.encode(se(i)));
    let c;
    this._protectedHeader ? c = te.encode(se(JSON.stringify(this._protectedHeader))) : c = te.encode("");
    const d = dt(c, te.encode("."), i), u = await y_(o, e, d), l = {
      signature: se(u),
      payload: ""
    };
    return a && (l.payload = Ke.decode(i)), this._unprotectedHeader && (l.header = this._unprotectedHeader), this._protectedHeader && (l.protected = Ke.decode(c)), l;
  }
}
class al {
  constructor(e) {
    this._flattened = new ec(e);
  }
  setProtectedHeader(e) {
    return this._flattened.setProtectedHeader(e), this;
  }
  async sign(e, r) {
    const n = await this._flattened.sign(e, r);
    if (n.payload === void 0)
      throw new TypeError("use the flattened module for creating JWS with b64: false");
    return `${n.protected}.${n.payload}.${n.signature}`;
  }
}
class m_ {
  constructor(e, r, n) {
    this.parent = e, this.key = r, this.options = n;
  }
  setProtectedHeader(e) {
    if (this.protectedHeader)
      throw new TypeError("setProtectedHeader can only be called once");
    return this.protectedHeader = e, this;
  }
  setUnprotectedHeader(e) {
    if (this.unprotectedHeader)
      throw new TypeError("setUnprotectedHeader can only be called once");
    return this.unprotectedHeader = e, this;
  }
  addSignature(...e) {
    return this.parent.addSignature(...e);
  }
  sign(...e) {
    return this.parent.sign(...e);
  }
  done() {
    return this.parent;
  }
}
class __ {
  constructor(e) {
    this._signatures = [], this._payload = e;
  }
  addSignature(e, r) {
    const n = new m_(this, e, r);
    return this._signatures.push(n), n;
  }
  async sign() {
    if (!this._signatures.length)
      throw new L("at least one signature must be added");
    const e = {
      signatures: [],
      payload: ""
    };
    for (let r = 0; r < this._signatures.length; r++) {
      const n = this._signatures[r], s = new ec(this._payload);
      s.setProtectedHeader(n.protectedHeader), s.setUnprotectedHeader(n.unprotectedHeader);
      const { payload: a, ...o } = await s.sign(n.key, n.options);
      if (r === 0)
        e.payload = a;
      else if (e.payload !== a)
        throw new L("inconsistent use of JWS Unencoded Payload (RFC7797)");
      e.signatures.push(o);
    }
    return e;
  }
}
function Jt(t, e) {
  if (!Number.isFinite(e))
    throw new TypeError(`Invalid ${t} input`);
  return e;
}
class tc {
  constructor(e = {}) {
    if (!re(e))
      throw new TypeError("JWT Claims Set MUST be an object");
    this._payload = e;
  }
  setIssuer(e) {
    return this._payload = { ...this._payload, iss: e }, this;
  }
  setSubject(e) {
    return this._payload = { ...this._payload, sub: e }, this;
  }
  setAudience(e) {
    return this._payload = { ...this._payload, aud: e }, this;
  }
  setJti(e) {
    return this._payload = { ...this._payload, jti: e }, this;
  }
  setNotBefore(e) {
    return typeof e == "number" ? this._payload = { ...this._payload, nbf: Jt("setNotBefore", e) } : e instanceof Date ? this._payload = { ...this._payload, nbf: Jt("setNotBefore", It(e)) } : this._payload = { ...this._payload, nbf: It(/* @__PURE__ */ new Date()) + dn(e) }, this;
  }
  setExpirationTime(e) {
    return typeof e == "number" ? this._payload = { ...this._payload, exp: Jt("setExpirationTime", e) } : e instanceof Date ? this._payload = { ...this._payload, exp: Jt("setExpirationTime", It(e)) } : this._payload = { ...this._payload, exp: It(/* @__PURE__ */ new Date()) + dn(e) }, this;
  }
  setIssuedAt(e) {
    return typeof e > "u" ? this._payload = { ...this._payload, iat: It(/* @__PURE__ */ new Date()) } : e instanceof Date ? this._payload = { ...this._payload, iat: Jt("setIssuedAt", It(e)) } : typeof e == "string" ? this._payload = {
      ...this._payload,
      iat: Jt("setIssuedAt", It(/* @__PURE__ */ new Date()) + dn(e))
    } : this._payload = { ...this._payload, iat: Jt("setIssuedAt", e) }, this;
  }
}
class g_ extends tc {
  setProtectedHeader(e) {
    return this._protectedHeader = e, this;
  }
  async sign(e, r) {
    var s;
    const n = new al(te.encode(JSON.stringify(this._payload)));
    if (n.setProtectedHeader(this._protectedHeader), Array.isArray((s = this._protectedHeader) == null ? void 0 : s.crit) && this._protectedHeader.crit.includes("b64") && this._protectedHeader.b64 === !1)
      throw new Ie("JWTs MUST NOT use unencoded payload");
    return n.sign(e, r);
  }
}
class w_ extends tc {
  setProtectedHeader(e) {
    if (this._protectedHeader)
      throw new TypeError("setProtectedHeader can only be called once");
    return this._protectedHeader = e, this;
  }
  setKeyManagementParameters(e) {
    if (this._keyManagementParameters)
      throw new TypeError("setKeyManagementParameters can only be called once");
    return this._keyManagementParameters = e, this;
  }
  setContentEncryptionKey(e) {
    if (this._cek)
      throw new TypeError("setContentEncryptionKey can only be called once");
    return this._cek = e, this;
  }
  setInitializationVector(e) {
    if (this._iv)
      throw new TypeError("setInitializationVector can only be called once");
    return this._iv = e, this;
  }
  replicateIssuerAsHeader() {
    return this._replicateIssuerAsHeader = !0, this;
  }
  replicateSubjectAsHeader() {
    return this._replicateSubjectAsHeader = !0, this;
  }
  replicateAudienceAsHeader() {
    return this._replicateAudienceAsHeader = !0, this;
  }
  async encrypt(e, r) {
    const n = new sl(te.encode(JSON.stringify(this._payload)));
    return this._replicateIssuerAsHeader && (this._protectedHeader = { ...this._protectedHeader, iss: this._payload.iss }), this._replicateSubjectAsHeader && (this._protectedHeader = { ...this._protectedHeader, sub: this._payload.sub }), this._replicateAudienceAsHeader && (this._protectedHeader = { ...this._protectedHeader, aud: this._payload.aud }), n.setProtectedHeader(this._protectedHeader), this._iv && n.setInitializationVector(this._iv), this._cek && n.setContentEncryptionKey(this._cek), this._keyManagementParameters && n.setKeyManagementParameters(this._keyManagementParameters), n.encrypt(e, r);
  }
}
const vt = (t, e) => {
  if (typeof t != "string" || !t)
    throw new Fi(`${e} missing or invalid`);
};
async function ol(t, e) {
  if (!re(t))
    throw new TypeError("JWK must be an object");
  if (e ?? (e = "sha256"), e !== "sha256" && e !== "sha384" && e !== "sha512")
    throw new TypeError('digestAlgorithm must one of "sha256", "sha384", or "sha512"');
  let r;
  switch (t.kty) {
    case "EC":
      vt(t.crv, '"crv" (Curve) Parameter'), vt(t.x, '"x" (X Coordinate) Parameter'), vt(t.y, '"y" (Y Coordinate) Parameter'), r = { crv: t.crv, kty: t.kty, x: t.x, y: t.y };
      break;
    case "OKP":
      vt(t.crv, '"crv" (Subtype of Key Pair) Parameter'), vt(t.x, '"x" (Public Key) Parameter'), r = { crv: t.crv, kty: t.kty, x: t.x };
      break;
    case "RSA":
      vt(t.e, '"e" (Exponent) Parameter'), vt(t.n, '"n" (Modulus) Parameter'), r = { e: t.e, kty: t.kty, n: t.n };
      break;
    case "oct":
      vt(t.k, '"k" (Key Value) Parameter'), r = { k: t.k, kty: t.kty };
      break;
    default:
      throw new x('"kty" (Key Type) Parameter missing or unsupported');
  }
  const n = te.encode(JSON.stringify(r));
  return se(await Eu(e, n));
}
async function v_(t, e) {
  e ?? (e = "sha256");
  const r = await ol(t, e);
  return `urn:ietf:params:oauth:jwk-thumbprint:sha-${e.slice(-3)}:${r}`;
}
async function b_(t, e) {
  const r = {
    ...t,
    ...e == null ? void 0 : e.header
  };
  if (!re(r.jwk))
    throw new L('"jwk" (JSON Web Key) Header Parameter must be a JSON object');
  const n = await $n({ ...r.jwk, ext: !0 }, r.alg);
  if (n instanceof Uint8Array || n.type !== "public")
    throw new L('"jwk" (JSON Web Key) Header Parameter must be a public key');
  return n;
}
function S_(t) {
  switch (typeof t == "string" && t.slice(0, 2)) {
    case "RS":
    case "PS":
      return "RSA";
    case "ES":
      return "EC";
    case "Ed":
      return "OKP";
    default:
      throw new x('Unsupported "alg" value for a JSON Web Key Set');
  }
}
function E_(t) {
  return t && typeof t == "object" && Array.isArray(t.keys) && t.keys.every(A_);
}
function A_(t) {
  return re(t);
}
function il(t) {
  return typeof structuredClone == "function" ? structuredClone(t) : JSON.parse(JSON.stringify(t));
}
class P_ {
  constructor(e) {
    if (this._cached = /* @__PURE__ */ new WeakMap(), !E_(e))
      throw new $a("JSON Web Key Set malformed");
    this._jwks = il(e);
  }
  async getKey(e, r) {
    const { alg: n, kid: s } = { ...e, ...r == null ? void 0 : r.header }, a = S_(n), o = this._jwks.keys.filter((d) => {
      let u = a === d.kty;
      if (u && typeof s == "string" && (u = s === d.kid), u && typeof d.alg == "string" && (u = n === d.alg), u && typeof d.use == "string" && (u = d.use === "sig"), u && Array.isArray(d.key_ops) && (u = d.key_ops.includes("verify")), u)
        switch (n) {
          case "ES256":
            u = d.crv === "P-256";
            break;
          case "ES256K":
            u = d.crv === "secp256k1";
            break;
          case "ES384":
            u = d.crv === "P-384";
            break;
          case "ES512":
            u = d.crv === "P-521";
            break;
          case "Ed25519":
            u = d.crv === "Ed25519";
            break;
          case "EdDSA":
            u = d.crv === "Ed25519" || d.crv === "Ed448";
            break;
        }
      return u;
    }), { 0: i, length: c } = o;
    if (c === 0)
      throw new Ma();
    if (c !== 1) {
      const d = new Bi(), { _cached: u } = this;
      throw d[Symbol.asyncIterator] = async function* () {
        for (const l of o)
          try {
            yield await Gc(u, l, n);
          } catch {
          }
      }, d;
    }
    return Gc(this._cached, i, n);
  }
}
async function Gc(t, e, r) {
  const n = t.get(e) || t.set(e, {}).get(e);
  if (n[r] === void 0) {
    const s = await $n({ ...e, ext: !0 }, r);
    if (s instanceof Uint8Array || s.type !== "public")
      throw new $a("JSON Web Key Set members must be public keys");
    n[r] = s;
  }
  return n[r];
}
function Si(t) {
  const e = new P_(t), r = async (n, s) => e.getKey(n, s);
  return Object.defineProperties(r, {
    jwks: {
      value: () => il(e._jwks),
      enumerable: !0,
      configurable: !1,
      writable: !1
    }
  }), r;
}
const I_ = async (t, e, r) => {
  let n, s, a = !1;
  typeof AbortController == "function" && (n = new AbortController(), s = setTimeout(() => {
    a = !0, n.abort();
  }, e));
  const o = await fetch(t.href, {
    signal: n ? n.signal : void 0,
    redirect: "manual",
    headers: r.headers
  }).catch((i) => {
    throw a ? new Vi() : i;
  });
  if (s !== void 0 && clearTimeout(s), o.status !== 200)
    throw new fe("Expected 200 OK from the JSON Web Key Set HTTP response");
  try {
    return await o.json();
  } catch {
    throw new fe("Failed to parse the JSON Web Key Set HTTP response as JSON");
  }
};
function C_() {
  return typeof WebSocketPair < "u" || typeof navigator < "u" && navigator.userAgent === "Cloudflare-Workers" || typeof EdgeRuntime < "u" && EdgeRuntime === "vercel";
}
let Ei;
var Bs, kd;
(typeof navigator > "u" || !((kd = (Bs = navigator.userAgent) == null ? void 0 : Bs.startsWith) != null && kd.call(Bs, "Mozilla/5.0 "))) && (Ei = "jose/v5.10.0");
const un = Symbol();
function O_(t, e) {
  return !(typeof t != "object" || t === null || !("uat" in t) || typeof t.uat != "number" || Date.now() - t.uat >= e || !("jwks" in t) || !re(t.jwks) || !Array.isArray(t.jwks.keys) || !Array.prototype.every.call(t.jwks.keys, re));
}
class T_ {
  constructor(e, r) {
    if (!(e instanceof URL))
      throw new TypeError("url must be an instance of URL");
    this._url = new URL(e.href), this._options = { agent: r == null ? void 0 : r.agent, headers: r == null ? void 0 : r.headers }, this._timeoutDuration = typeof (r == null ? void 0 : r.timeoutDuration) == "number" ? r == null ? void 0 : r.timeoutDuration : 5e3, this._cooldownDuration = typeof (r == null ? void 0 : r.cooldownDuration) == "number" ? r == null ? void 0 : r.cooldownDuration : 3e4, this._cacheMaxAge = typeof (r == null ? void 0 : r.cacheMaxAge) == "number" ? r == null ? void 0 : r.cacheMaxAge : 6e5, (r == null ? void 0 : r[un]) !== void 0 && (this._cache = r == null ? void 0 : r[un], O_(r == null ? void 0 : r[un], this._cacheMaxAge) && (this._jwksTimestamp = this._cache.uat, this._local = Si(this._cache.jwks)));
  }
  coolingDown() {
    return typeof this._jwksTimestamp == "number" ? Date.now() < this._jwksTimestamp + this._cooldownDuration : !1;
  }
  fresh() {
    return typeof this._jwksTimestamp == "number" ? Date.now() < this._jwksTimestamp + this._cacheMaxAge : !1;
  }
  async getKey(e, r) {
    (!this._local || !this.fresh()) && await this.reload();
    try {
      return await this._local(e, r);
    } catch (n) {
      if (n instanceof Ma && this.coolingDown() === !1)
        return await this.reload(), this._local(e, r);
      throw n;
    }
  }
  async reload() {
    this._pendingFetch && C_() && (this._pendingFetch = void 0);
    const e = new Headers(this._options.headers);
    Ei && !e.has("User-Agent") && (e.set("User-Agent", Ei), this._options.headers = Object.fromEntries(e.entries())), this._pendingFetch || (this._pendingFetch = I_(this._url, this._timeoutDuration, this._options).then((r) => {
      this._local = Si(r), this._cache && (this._cache.uat = Date.now(), this._cache.jwks = r), this._jwksTimestamp = Date.now(), this._pendingFetch = void 0;
    }).catch((r) => {
      throw this._pendingFetch = void 0, r;
    })), await this._pendingFetch;
  }
}
function R_(t, e) {
  const r = new T_(t, e), n = async (s, a) => r.getKey(s, a);
  return Object.defineProperties(n, {
    coolingDown: {
      get: () => r.coolingDown(),
      enumerable: !0,
      configurable: !1
    },
    fresh: {
      get: () => r.fresh(),
      enumerable: !0,
      configurable: !1
    },
    reload: {
      value: () => r.reload(),
      enumerable: !0,
      configurable: !1,
      writable: !1
    },
    reloading: {
      get: () => !!r._pendingFetch,
      enumerable: !0,
      configurable: !1
    },
    jwks: {
      value: () => {
        var s;
        return (s = r._local) == null ? void 0 : s.jwks();
      },
      enumerable: !0,
      configurable: !1,
      writable: !1
    }
  }), n;
}
const k_ = un;
class j_ extends tc {
  encode() {
    const e = se(JSON.stringify({ alg: "none" })), r = se(JSON.stringify(this._payload));
    return `${e}.${r}.`;
  }
  static decode(e, r) {
    if (typeof e != "string")
      throw new Ie("Unsecured JWT must be a string");
    const { 0: n, 1: s, 2: a, length: o } = e.split(".");
    if (o !== 3 || a !== "")
      throw new Ie("Invalid Unsecured JWT");
    let i;
    try {
      if (i = JSON.parse(Ke.decode(ee(n))), i.alg !== "none")
        throw new Error();
    } catch {
      throw new Ie("Invalid Unsecured JWT");
    }
    return { payload: Qi(i, ee(s), r), header: i };
  }
}
const D_ = se, rc = ee, z_ = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  decode: rc,
  encode: D_
}, Symbol.toStringTag, { value: "Module" }));
function $_(t) {
  let e;
  if (typeof t == "string") {
    const r = t.split(".");
    (r.length === 3 || r.length === 5) && ([e] = r);
  } else if (typeof t == "object" && t)
    if ("protected" in t)
      e = t.protected;
    else
      throw new TypeError("Token does not contain a Protected Header");
  try {
    if (typeof e != "string" || !e)
      throw new Error();
    const r = JSON.parse(Ke.decode(rc(e)));
    if (!re(r))
      throw new Error();
    return r;
  } catch {
    throw new TypeError("Invalid Token or Protected Header formatting");
  }
}
function M_(t) {
  if (typeof t != "string")
    throw new Ie("JWTs must use Compact JWS serialization, JWT must be a string");
  const { 1: e, length: r } = t.split(".");
  if (r === 5)
    throw new Ie("Only JWTs using Compact JWS serialization can be decoded");
  if (r !== 3)
    throw new Ie("Invalid JWT");
  if (!e)
    throw new Ie("JWTs must contain a payload");
  let n;
  try {
    n = rc(e);
  } catch {
    throw new Ie("Failed to base64url decode the payload");
  }
  let s;
  try {
    s = JSON.parse(Ke.decode(n));
  } catch {
    throw new Ie("Failed to parse the decoded payload as JSON");
  }
  if (!re(s))
    throw new Ie("Invalid JWT Claims Set");
  return s;
}
async function U_(t, e) {
  let r, n, s;
  switch (t) {
    case "HS256":
    case "HS384":
    case "HS512":
      r = parseInt(t.slice(-3), 10), n = { name: "HMAC", hash: `SHA-${r}`, length: r }, s = ["sign", "verify"];
      break;
    case "A128CBC-HS256":
    case "A192CBC-HS384":
    case "A256CBC-HS512":
      return r = parseInt(t.slice(-3), 10), Ka(new Uint8Array(r >> 3));
    case "A128KW":
    case "A192KW":
    case "A256KW":
      r = parseInt(t.slice(1, 4), 10), n = { name: "AES-KW", length: r }, s = ["wrapKey", "unwrapKey"];
      break;
    case "A128GCMKW":
    case "A192GCMKW":
    case "A256GCMKW":
    case "A128GCM":
    case "A192GCM":
    case "A256GCM":
      r = parseInt(t.slice(1, 4), 10), n = { name: "AES-GCM", length: r }, s = ["encrypt", "decrypt"];
      break;
    default:
      throw new x('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
  }
  return M.subtle.generateKey(n, (e == null ? void 0 : e.extractable) ?? !1, s);
}
function Vo(t) {
  const e = (t == null ? void 0 : t.modulusLength) ?? 2048;
  if (typeof e != "number" || e < 2048)
    throw new x("Invalid or unsupported modulusLength option provided, 2048 bits or larger keys must be used");
  return e;
}
async function K_(t, e) {
  let r, n;
  switch (t) {
    case "PS256":
    case "PS384":
    case "PS512":
      r = {
        name: "RSA-PSS",
        hash: `SHA-${t.slice(-3)}`,
        publicExponent: new Uint8Array([1, 0, 1]),
        modulusLength: Vo(e)
      }, n = ["sign", "verify"];
      break;
    case "RS256":
    case "RS384":
    case "RS512":
      r = {
        name: "RSASSA-PKCS1-v1_5",
        hash: `SHA-${t.slice(-3)}`,
        publicExponent: new Uint8Array([1, 0, 1]),
        modulusLength: Vo(e)
      }, n = ["sign", "verify"];
      break;
    case "RSA-OAEP":
    case "RSA-OAEP-256":
    case "RSA-OAEP-384":
    case "RSA-OAEP-512":
      r = {
        name: "RSA-OAEP",
        hash: `SHA-${parseInt(t.slice(-3), 10) || 1}`,
        publicExponent: new Uint8Array([1, 0, 1]),
        modulusLength: Vo(e)
      }, n = ["decrypt", "unwrapKey", "encrypt", "wrapKey"];
      break;
    case "ES256":
      r = { name: "ECDSA", namedCurve: "P-256" }, n = ["sign", "verify"];
      break;
    case "ES384":
      r = { name: "ECDSA", namedCurve: "P-384" }, n = ["sign", "verify"];
      break;
    case "ES512":
      r = { name: "ECDSA", namedCurve: "P-521" }, n = ["sign", "verify"];
      break;
    case "Ed25519":
      r = { name: "Ed25519" }, n = ["sign", "verify"];
      break;
    case "EdDSA": {
      n = ["sign", "verify"];
      const s = (e == null ? void 0 : e.crv) ?? "Ed25519";
      switch (s) {
        case "Ed25519":
        case "Ed448":
          r = { name: s };
          break;
        default:
          throw new x("Invalid or unsupported crv option provided");
      }
      break;
    }
    case "ECDH-ES":
    case "ECDH-ES+A128KW":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A256KW": {
      n = ["deriveKey", "deriveBits"];
      const s = (e == null ? void 0 : e.crv) ?? "P-256";
      switch (s) {
        case "P-256":
        case "P-384":
        case "P-521": {
          r = { name: "ECDH", namedCurve: s };
          break;
        }
        case "X25519":
        case "X448":
          r = { name: s };
          break;
        default:
          throw new x("Invalid or unsupported crv option provided, supported values are P-256, P-384, P-521, X25519, and X448");
      }
      break;
    }
    default:
      throw new x('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
  }
  return M.subtle.generateKey(r, (e == null ? void 0 : e.extractable) ?? !1, n);
}
async function x_(t, e) {
  return K_(t, e);
}
async function L_(t, e) {
  return U_(t, e);
}
const N_ = "WebCryptoAPI", W_ = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  CompactEncrypt: sl,
  CompactSign: al,
  EmbeddedJWK: b_,
  EncryptJWT: w_,
  FlattenedEncrypt: ha,
  FlattenedSign: ec,
  GeneralEncrypt: o_,
  GeneralSign: __,
  SignJWT: g_,
  UnsecuredJWT: j_,
  base64url: z_,
  calculateJwkThumbprint: ol,
  calculateJwkThumbprintUri: v_,
  compactDecrypt: qu,
  compactVerify: tl,
  createLocalJWKSet: Si,
  createRemoteJWKSet: R_,
  cryptoRuntime: N_,
  decodeJwt: M_,
  decodeProtectedHeader: $_,
  errors: gm,
  experimental_jwksCache: k_,
  exportJWK: Yu,
  exportPKCS8: s_,
  exportSPKI: n_,
  flattenedDecrypt: Gi,
  flattenedVerify: Yi,
  generalDecrypt: t_,
  generalVerify: c_,
  generateKeyPair: x_,
  generateSecret: L_,
  importJWK: $n,
  importPKCS8: Bm,
  importSPKI: Zm,
  importX509: Fm,
  jwksCache: un,
  jwtDecrypt: p_,
  jwtVerify: f_
}, Symbol.toStringTag, { value: "Module" })), H_ = /* @__PURE__ */ Kd(W_);
var nc = {};
Object.defineProperty(nc, "__esModule", { value: !0 });
nc.either = J_;
function J_(t, e) {
  if (t != null && e != null && t !== e)
    throw new TypeError(`Expected "${e}", got "${t}"`);
  return t ?? e ?? void 0;
}
Object.defineProperty(za, "__esModule", { value: !0 });
za.JoseKey = void 0;
const Bt = H_, Q = ct, Z_ = nc, { JOSEError: Yc } = Bt.errors;
class sc extends Q.Key {
  /**
   * Some runtimes (e.g. Bun) require an `alg` second argument to be set when
   * invoking `importJWK`. In order to be compatible with these runtimes, we
   * provide the following method to ensure the `alg` is always set. We also
   * take the opportunity to ensure that the `alg` is compatible with this key.
   */
  async getKeyObj(e) {
    if (!this.algorithms.includes(e))
      throw new Q.JwkError(`Key cannot be used with algorithm "${e}"`);
    try {
      return await (0, Bt.importJWK)(this.jwk, e);
    } catch (r) {
      throw new Q.JwkError("Failed to import JWK", void 0, { cause: r });
    }
  }
  async createJwt(e, r) {
    try {
      const { kid: n } = e;
      if (n && n !== this.kid)
        throw new Q.JwtCreateError(`Invalid "kid" (${n}) used to sign with key "${this.kid}"`);
      const { alg: s } = e;
      if (!s)
        throw new Q.JwtCreateError('Missing "alg" in JWT header');
      const a = await this.getKeyObj(s);
      return await new Bt.SignJWT(r).setProtectedHeader({
        ...e,
        alg: s,
        kid: this.kid
      }).sign(a);
    } catch (n) {
      throw n instanceof Yc ? new Q.JwtCreateError(n.message, n.code, { cause: n }) : Q.JwtCreateError.from(n);
    }
  }
  async verifyJwt(e, r) {
    try {
      const n = await (0, Bt.jwtVerify)(e, async ({ alg: o }) => this.getKeyObj(o), { ...r, algorithms: this.algorithms }), s = Q.jwtHeaderSchema.safeParse(n.protectedHeader);
      if (!s.success)
        throw new Q.JwtVerifyError("Invalid JWT header", void 0, {
          cause: s.error
        });
      const a = Q.jwtPayloadSchema.safeParse(n.payload);
      if (!a.success)
        throw new Q.JwtVerifyError("Invalid JWT payload", void 0, {
          cause: a.error
        });
      return {
        protectedHeader: s.data,
        // "requiredClaims" enforced by jwtVerify()
        payload: a.data
      };
    } catch (n) {
      throw n instanceof Yc ? new Q.JwtVerifyError(n.message, n.code, { cause: n }) : Q.JwtVerifyError.from(n);
    }
  }
  static async generateKeyPair(e = ["ES256"], r) {
    if (!e.length)
      throw new Q.JwkError("No algorithms provided for key generation");
    const n = [];
    for (const s of e)
      try {
        return await (0, Bt.generateKeyPair)(s, r);
      } catch (a) {
        n.push(a);
      }
    throw new Q.JwkError("Failed to generate key pair", void 0, {
      cause: new AggregateError(n, "None of the algorithms worked")
    });
  }
  static async generate(e = ["ES256"], r, n) {
    const s = await this.generateKeyPair(e, {
      ...n,
      extractable: !0
    });
    return this.fromKeyLike(s.privateKey, r);
  }
  static async fromImportable(e, r) {
    if (typeof e == "string") {
      if (e.startsWith("-----"))
        return this.fromPKCS8(e, "", r);
      if (e.startsWith("{"))
        return this.fromJWK(e, r);
      throw new Q.JwkError("Invalid input");
    }
    if (typeof e == "object")
      return "kty" in e || "alg" in e ? this.fromJWK(e, r) : this.fromKeyLike(e, r);
    throw new Q.JwkError("Invalid input");
  }
  /**
   * @see {@link exportJWK}
   */
  static async fromKeyLike(e, r, n) {
    const s = await (0, Bt.exportJWK)(e);
    if (n) {
      if (!s.alg)
        s.alg = n;
      else if (s.alg !== n)
        throw new Q.JwkError('Invalid "alg" in JWK');
    }
    return this.fromJWK(s, r);
  }
  /**
   * @see {@link importPKCS8}
   */
  static async fromPKCS8(e, r, n) {
    const s = await (0, Bt.importPKCS8)(e, r, { extractable: !0 });
    return this.fromKeyLike(s, n);
  }
  static async fromJWK(e, r) {
    const n = typeof e == "string" ? JSON.parse(e) : e;
    if (!n || typeof n != "object")
      throw new Q.JwkError("Invalid JWK");
    const s = (0, Z_.either)(n.kid, r);
    return n.use != null && (0, Q.isPrivateJwk)(n) && (console.warn('Deprecation warning: Private JWK with a "use" property will be rejected in the future. Please remove replace "use" with (valid) "key_ops".'), n.key_ops ?? (n.key_ops = n.use === "sig" ? ["sign"] : ["encrypt"]), delete n.use), new sc(Q.jwkSchema.parse({ ...n, kid: s }));
  }
}
za.JoseKey = sc;
(function(t) {
  var e = v && v.__createBinding || (Object.create ? function(n, s, a, o) {
    o === void 0 && (o = a);
    var i = Object.getOwnPropertyDescriptor(s, a);
    (!i || ("get" in i ? !s.__esModule : i.writable || i.configurable)) && (i = { enumerable: !0, get: function() {
      return s[a];
    } }), Object.defineProperty(n, o, i);
  } : function(n, s, a, o) {
    o === void 0 && (o = a), n[o] = s[a];
  }), r = v && v.__exportStar || function(n, s) {
    for (var a in n) a !== "default" && !Object.prototype.hasOwnProperty.call(s, a) && e(s, n, a);
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), r(za, t);
})(Su);
var Un = {};
Object.defineProperty(Un, "__esModule", { value: !0 });
Un.toSubtleAlgorithm = F_;
Un.fromSubtleAlgorithm = B_;
Un.isCryptoKeyPair = V_;
function F_(t, e, r) {
  switch (t) {
    case "PS256":
    case "PS384":
    case "PS512":
      return {
        name: "RSA-PSS",
        hash: `SHA-${t.slice(-3)}`,
        modulusLength: (r == null ? void 0 : r.modulusLength) ?? 2048,
        publicExponent: new Uint8Array([1, 0, 1])
      };
    case "RS256":
    case "RS384":
    case "RS512":
      return {
        name: "RSASSA-PKCS1-v1_5",
        hash: `SHA-${t.slice(-3)}`,
        modulusLength: (r == null ? void 0 : r.modulusLength) ?? 2048,
        publicExponent: new Uint8Array([1, 0, 1])
      };
    case "ES256":
    case "ES384":
      return {
        name: "ECDSA",
        namedCurve: `P-${t.slice(-3)}`
      };
    case "ES512":
      return {
        name: "ECDSA",
        namedCurve: "P-521"
      };
    default:
      throw new TypeError(`Unsupported alg "${t}"`);
  }
}
function B_(t) {
  switch (t.name) {
    case "RSA-PSS":
    case "RSASSA-PKCS1-v1_5": {
      const e = t.hash.name;
      switch (e) {
        case "SHA-256":
        case "SHA-384":
        case "SHA-512":
          return `${t.name === "RSA-PSS" ? "PS" : "RS"}${e.slice(-3)}`;
        default:
          throw new TypeError("unsupported RsaHashedKeyAlgorithm hash");
      }
    }
    case "ECDSA": {
      const e = t.namedCurve;
      switch (e) {
        case "P-256":
        case "P-384":
        case "P-512":
          return `ES${e.slice(-3)}`;
        case "P-521":
          return "ES512";
        default:
          throw new TypeError("unsupported EcKeyAlgorithm namedCurve");
      }
    }
    case "Ed448":
    case "Ed25519":
      return "EdDSA";
    default:
      throw new TypeError(`Unexpected algorithm "${t.name}"`);
  }
}
function V_(t, e) {
  return typeof t == "object" && t !== null && "privateKey" in t && t.privateKey instanceof CryptoKey && t.privateKey.type === "private" && (e == null || t.privateKey.extractable === e) && t.privateKey.usages.includes("sign") && "publicKey" in t && t.publicKey instanceof CryptoKey && t.publicKey.type === "public" && t.publicKey.extractable === !0 && t.publicKey.usages.includes("verify");
}
Object.defineProperty(Pa, "__esModule", { value: !0 });
Pa.WebcryptoKey = void 0;
const qo = ct, q_ = Su, Xc = Un;
class ac extends q_.JoseKey {
  // We need to override the static method generate from JoseKey because
  // the browser needs both the private and public keys
  static async generate(e = ["ES256"], r = crypto.randomUUID(), n) {
    const s = await this.generateKeyPair(e, n);
    if (!(0, Xc.isCryptoKeyPair)(s))
      throw new TypeError("Invalid CryptoKeyPair");
    return this.fromKeypair(s, r);
  }
  static async fromKeypair(e, r) {
    const { alg: n = (0, Xc.fromSubtleAlgorithm)(e.privateKey.algorithm), ...s } = await crypto.subtle.exportKey("jwk", e.privateKey.extractable ? e.privateKey : e.publicKey);
    return new ac(qo.jwkSchema.parse({ ...s, kid: r, alg: n }), e);
  }
  constructor(e, r) {
    if (!e.alg)
      throw new qo.JwkError('JWK "alg" is required for Webcrypto keys');
    super(e), Object.defineProperty(this, "cryptoKeyPair", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: r
    });
  }
  get isPrivate() {
    return !0;
  }
  async getKeyObj(e) {
    if (this.jwk.alg !== e)
      throw new qo.JwkError(`Key cannot be used with algorithm "${e}"`);
    return this.cryptoKeyPair.privateKey;
  }
}
Pa.WebcryptoKey = ac;
(function(t) {
  var e = v && v.__createBinding || (Object.create ? function(n, s, a, o) {
    o === void 0 && (o = a);
    var i = Object.getOwnPropertyDescriptor(s, a);
    (!i || ("get" in i ? !s.__esModule : i.writable || i.configurable)) && (i = { enumerable: !0, get: function() {
      return s[a];
    } }), Object.defineProperty(n, o, i);
  } : function(n, s, a, o) {
    o === void 0 && (o = a), n[o] = s[a];
  }), r = v && v.__exportStar || function(n, s) {
    for (var a in n) a !== "default" && !Object.prototype.hasOwnProperty.call(s, a) && e(s, n, a);
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), r(Pa, t);
})(Aa);
var oc = {}, Kn = {}, Lt = {}, Xe = {}, ot = {};
Object.defineProperty(ot, "__esModule", { value: !0 });
ot.InvalidDidError = ot.DidError = void 0;
class In extends Error {
  constructor(e, r, n, s = 400, a) {
    super(r, { cause: a }), Object.defineProperty(this, "did", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: e
    }), Object.defineProperty(this, "code", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: n
    }), Object.defineProperty(this, "status", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: s
    });
  }
  /**
   * For compatibility with error handlers in common HTTP frameworks.
   */
  get statusCode() {
    return this.status;
  }
  toString() {
    return `${this.constructor.name} ${this.code} (${this.did}): ${this.message}`;
  }
  static from(e, r) {
    if (e instanceof In)
      return e;
    const n = e instanceof Error ? e.message : typeof e == "string" ? e : "An unknown error occurred", s = (typeof (e == null ? void 0 : e.statusCode) == "number" ? e.statusCode : void 0) ?? (typeof (e == null ? void 0 : e.status) == "number" ? e.status : void 0);
    return new In(r, n, "did-unknown-error", s, e);
  }
}
ot.DidError = In;
class G_ extends In {
  constructor(e, r, n) {
    super(e, r, "did-invalid", 400, n);
  }
}
ot.InvalidDidError = G_;
var xn = {};
Object.defineProperty(xn, "__esModule", { value: !0 });
xn.isFragment = Y_;
xn.isHexDigit = Ai;
function Y_(t, e = 0, r = t.length) {
  let n;
  for (let s = e; s < r; s++)
    if (n = t.charCodeAt(s), !(n >= 65 && n <= 90 || n >= 97 && n <= 122 || n >= 48 && n <= 57 || n === 45 || n === 46 || n === 95 || n === 126)) {
      if (!(n === 33 || n === 36 || n === 38 || n === 39 || n === 40 || n === 41 || n === 42 || n === 43 || n === 44 || n === 59 || n === 61)) {
        if (!(n === 58 || n === 64)) {
          if (!(n === 47 || n === 63)) if (n === 37) {
            if (s + 2 >= r || !Ai(t.charCodeAt(s + 1)) || !Ai(t.charCodeAt(s + 2)))
              return !1;
            s += 2;
          } else
            return !1;
        }
      }
    }
  return !0;
}
function Ai(t) {
  return t >= 48 && t <= 57 || // 0-9
  t >= 65 && t <= 70 || // A-F
  t >= 97 && t <= 102;
}
var ic = {}, ar = {};
Object.defineProperty(ar, "__esModule", { value: !0 });
ar.DID_PLC_PREFIX = void 0;
ar.isDidPlc = X_;
ar.asDidPlc = Q_;
ar.assertDidPlc = dl;
const $s = ot, Na = "did:plc:";
ar.DID_PLC_PREFIX = Na;
const cl = Na.length, ln = 32;
function X_(t) {
  if (typeof t != "string" || t.length !== ln || !t.startsWith(Na))
    return !1;
  for (let e = cl; e < ln; e++)
    if (!ul(t.charCodeAt(e)))
      return !1;
  return !0;
}
function Q_(t) {
  return dl(t), t;
}
function dl(t) {
  if (typeof t != "string")
    throw new $s.InvalidDidError(typeof t, "DID must be a string");
  if (!t.startsWith(Na))
    throw new $s.InvalidDidError(t, "Invalid did:plc prefix");
  if (t.length !== ln)
    throw new $s.InvalidDidError(t, `did:plc must be ${ln} characters long`);
  for (let e = cl; e < ln; e++)
    if (!ul(t.charCodeAt(e)))
      throw new $s.InvalidDidError(t, `Invalid character at position ${e}`);
}
const ul = (t) => t >= 97 && t <= 122 || t >= 50 && t <= 55;
var ll = {}, Te = {};
Object.defineProperty(Te, "__esModule", { value: !0 });
Te.didSchema = Te.DID_PREFIX = void 0;
Te.assertDidMethod = hl;
Te.extractDidMethod = eg;
Te.assertDidMsid = fl;
Te.assertDid = Wa;
Te.isDid = tg;
Te.asDid = rg;
const Qc = R, $e = ot, fa = "did:";
Te.DID_PREFIX = fa;
const pa = fa.length;
function hl(t, e = 0, r = t.length) {
  if (!Number.isFinite(r) || !Number.isFinite(e) || r < e || r > t.length)
    throw new TypeError("Invalid start or end position");
  if (r === e)
    throw new $e.InvalidDidError(t, "Empty method name");
  let n;
  for (let s = e; s < r; s++)
    if (n = t.charCodeAt(s), (n < 97 || n > 122) && // a-z
    (n < 48 || n > 57))
      throw new $e.InvalidDidError(t, `Invalid character at position ${s} in DID method name`);
}
function eg(t) {
  const e = t.indexOf(":", pa);
  return t.slice(pa, e);
}
function fl(t, e = 0, r = t.length) {
  if (!Number.isFinite(r) || !Number.isFinite(e) || r < e || r > t.length)
    throw new TypeError("Invalid start or end position");
  if (r === e)
    throw new $e.InvalidDidError(t, "DID method-specific id must not be empty");
  let n;
  for (let s = e; s < r; s++)
    if (n = t.charCodeAt(s), (n < 97 || n > 122) && // a-z
    (n < 65 || n > 90) && // A-Z
    (n < 48 || n > 57) && // 0-9
    n !== 46 && // .
    n !== 45 && // -
    n !== 95) {
      if (n === 58) {
        if (s === r - 1)
          throw new $e.InvalidDidError(t, 'DID cannot end with ":"');
        continue;
      }
      if (n === 37) {
        if (n = t.charCodeAt(++s), (n < 48 || n > 57) && (n < 65 || n > 70))
          throw new $e.InvalidDidError(t, `Invalid pct-encoded character at position ${s}`);
        if (n = t.charCodeAt(++s), (n < 48 || n > 57) && (n < 65 || n > 70))
          throw new $e.InvalidDidError(t, `Invalid pct-encoded character at position ${s}`);
        if (s >= r)
          throw new $e.InvalidDidError(t, `Incomplete pct-encoded character at position ${s - 2}`);
        continue;
      }
      throw new $e.InvalidDidError(t, `Disallowed character in DID at position ${s}`);
    }
}
function Wa(t) {
  if (typeof t != "string")
    throw new $e.InvalidDidError(typeof t, "DID must be a string");
  const { length: e } = t;
  if (e > 2048)
    throw new $e.InvalidDidError(t, "DID is too long (2048 chars max)");
  if (!t.startsWith(fa))
    throw new $e.InvalidDidError(t, `DID requires "${fa}" prefix`);
  const r = t.indexOf(":", pa);
  if (r === -1)
    throw new $e.InvalidDidError(t, "Missing colon after method name");
  hl(t, pa, r), fl(t, r + 1, e);
}
function tg(t) {
  try {
    return Wa(t), !0;
  } catch (e) {
    if (e instanceof $e.DidError)
      return !1;
    throw e;
  }
}
function rg(t) {
  return Wa(t), t;
}
Te.didSchema = Qc.z.string().superRefine((t, e) => {
  try {
    return Wa(t), !0;
  } catch (r) {
    return e.addIssue({
      code: Qc.z.ZodIssueCode.custom,
      message: r instanceof Error ? r.message : "Unexpected error"
    }), !1;
  }
});
(function(t) {
  var u;
  Object.defineProperty(t, "__esModule", { value: !0 }), t.DID_WEB_PREFIX = void 0, t.isDidWeb = s, t.asDidWeb = a, t.assertDidWeb = o, t.didWebToUrl = i, t.urlToDidWeb = c, t.buildDidWebUrl = d;
  const e = ot, r = Te;
  t.DID_WEB_PREFIX = "did:web:";
  const n = ((u = URL.canParse) == null ? void 0 : u.bind(URL)) ?? ((l, p) => {
    try {
      return new URL(l, p), !0;
    } catch {
      return !1;
    }
  });
  function s(l) {
    if (typeof l != "string" || !l.startsWith(t.DID_WEB_PREFIX) || l.charAt(t.DID_WEB_PREFIX.length) === ":")
      return !1;
    try {
      (0, r.assertDidMsid)(l, t.DID_WEB_PREFIX.length);
    } catch {
      return !1;
    }
    return n(d(l));
  }
  function a(l) {
    return o(l), l;
  }
  function o(l) {
    if (typeof l != "string")
      throw new e.InvalidDidError(typeof l, "DID must be a string");
    if (!l.startsWith(t.DID_WEB_PREFIX))
      throw new e.InvalidDidError(l, "Invalid did:web prefix");
    if (l.charAt(t.DID_WEB_PREFIX.length) === ":")
      throw new e.InvalidDidError(l, "did:web MSID must not start with a colon");
    if ((0, r.assertDidMsid)(l, t.DID_WEB_PREFIX.length), !n(d(l)))
      throw new e.InvalidDidError(l, "Invalid Web DID");
  }
  function i(l) {
    try {
      return new URL(d(l));
    } catch (p) {
      throw new e.InvalidDidError(l, "Invalid Web DID", p);
    }
  }
  function c(l) {
    const p = l.port ? `%3A${l.port}` : "", f = l.pathname === "/" ? "" : l.pathname.replaceAll("/", ":");
    return `did:web:${l.hostname}${p}${f}`;
  }
  function d(l) {
    const p = t.DID_WEB_PREFIX.length, f = l.indexOf(":", p), g = (f === -1 ? l.slice(p) : l.slice(p, f)).replaceAll("%3A", ":"), S = f === -1 ? "" : l.slice(f).replaceAll(":", "/");
    return `${g.startsWith("localhost") && (g.length === 9 || g.charCodeAt(9) === 58) ? "http" : "https"}://${g}${S}`;
  }
})(ll);
(function(t) {
  var e = v && v.__createBinding || (Object.create ? function(n, s, a, o) {
    o === void 0 && (o = a);
    var i = Object.getOwnPropertyDescriptor(s, a);
    (!i || ("get" in i ? !s.__esModule : i.writable || i.configurable)) && (i = { enumerable: !0, get: function() {
      return s[a];
    } }), Object.defineProperty(n, o, i);
  } : function(n, s, a, o) {
    o === void 0 && (o = a), n[o] = s[a];
  }), r = v && v.__exportStar || function(n, s) {
    for (var a in n) a !== "default" && !Object.prototype.hasOwnProperty.call(s, a) && e(s, n, a);
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), r(ar, t), r(ll, t);
})(ic);
Object.defineProperty(Xe, "__esModule", { value: !0 });
Xe.isAtprotoAudience = Xe.atprotoDidSchema = void 0;
Xe.isAtprotoDid = cc;
Xe.asAtprotoDid = ag;
Xe.assertAtprotoDid = pl;
Xe.assertAtprotoDidWeb = yl;
Xe.isAtprotoDidWeb = ml;
const ng = R, ya = ot, sg = xn, mt = ic;
Xe.atprotoDidSchema = ng.z.string().refine(cc, 'Atproto only allows "plc" and "web" DID methods');
function cc(t) {
  return (0, mt.isDidPlc)(t) || ml(t);
}
function ag(t) {
  return pl(t), t;
}
function pl(t) {
  if (typeof t != "string")
    throw new ya.InvalidDidError(typeof t, "DID must be a string");
  if (t.startsWith(mt.DID_PLC_PREFIX))
    (0, mt.assertDidPlc)(t);
  else if (t.startsWith(mt.DID_WEB_PREFIX))
    yl(t);
  else
    throw new ya.InvalidDidError(t, 'Atproto only allows "plc" and "web" DID methods');
}
function yl(t) {
  if ((0, mt.assertDidWeb)(t), _l(t))
    throw new ya.InvalidDidError(t, "Atproto does not allow path components in Web DIDs");
  if (gl(t))
    throw new ya.InvalidDidError(t, "Atproto does not allow port numbers in Web DIDs, except for localhost");
}
function ml(t) {
  return !(!(0, mt.isDidWeb)(t) || _l(t) || gl(t));
}
function _l(t) {
  return t.includes(":", mt.DID_WEB_PREFIX.length);
}
function og(t) {
  return t === "did:web:localhost" || t.startsWith("did:web:localhost:") || t.startsWith("did:web:localhost%3A");
}
function gl(t) {
  if (og(t))
    return !1;
  const e = t.indexOf(":", mt.DID_WEB_PREFIX.length);
  return e === -1 ? (
    // No path component, check if there's a port separator anywhere after
    // the "did:web:" prefix
    t.includes("%3A", mt.DID_WEB_PREFIX.length)
  ) : (
    // There is a path component; if there is an encoded colon *before* it,
    // then there is a port number
    t.lastIndexOf("%3A", e) !== -1
  );
}
const ig = (t) => {
  if (typeof t != "string")
    return !1;
  const e = t.indexOf("#");
  return e === -1 || t.indexOf("#", e + 1) !== -1 ? !1 : (0, sg.isFragment)(t, e + 1) && cc(t.slice(0, e));
};
Xe.isAtprotoAudience = ig;
var wl = {};
(function(t) {
  Object.defineProperty(t, "__esModule", { value: !0 }), t.didDocumentValidator = t.didDocumentSchema = void 0;
  const e = R, r = Te, n = xn, s = e.z.string().url("RFC3968 compliant URI"), a = e.z.union([r.didSchema, e.z.array(r.didSchema)]), o = e.z.union([
    s.refine((f) => {
      const _ = f.indexOf("#");
      return _ === -1 ? !1 : (0, n.isFragment)(f, _ + 1);
    }, {
      message: "Missing or invalid fragment in RFC3968 URI"
    }),
    e.z.string().refine((f) => f.charCodeAt(0) === 35, {
      message: "Fragment must start with #"
    }).refine((f) => (0, n.isFragment)(f, 1), {
      message: "Invalid char in URI fragment"
    })
  ]), i = e.z.object({
    id: o,
    type: e.z.string().min(1),
    controller: a,
    publicKeyJwk: e.z.record(e.z.string(), e.z.unknown()).optional(),
    publicKeyMultibase: e.z.string().optional()
  }), c = o, d = e.z.union([e.z.string(), e.z.array(e.z.string())]), u = e.z.union([
    s,
    e.z.record(e.z.string(), s),
    e.z.array(e.z.union([s, e.z.record(e.z.string(), s)])).nonempty()
  ]), l = e.z.object({
    id: c,
    type: d,
    serviceEndpoint: u
  }), p = e.z.union([
    //
    o,
    i
  ]);
  t.didDocumentSchema = e.z.object({
    "@context": e.z.union([
      e.z.literal("https://www.w3.org/ns/did/v1"),
      e.z.array(e.z.string().url()).nonempty().refine((f) => f[0] === "https://www.w3.org/ns/did/v1", {
        message: "First @context must be https://www.w3.org/ns/did/v1"
      })
    ]),
    id: r.didSchema,
    controller: a.optional(),
    alsoKnownAs: e.z.array(s).optional(),
    service: e.z.array(l).optional(),
    authentication: e.z.array(p).optional(),
    verificationMethod: e.z.array(e.z.union([i, o])).optional()
  }), t.didDocumentValidator = t.didDocumentSchema.superRefine(({ id: f, service: _ }, g) => {
    if (_) {
      const S = /* @__PURE__ */ new Set();
      for (let w = 0; w < _.length; w++) {
        const b = _[w], D = b.id.startsWith("#") ? `${f}${b.id}` : b.id;
        S.has(D) ? g.addIssue({
          code: e.z.ZodIssueCode.custom,
          message: `Duplicate service id (${b.id}) found in the document`,
          path: ["service", w, "id"]
        }) : S.add(D);
      }
    }
  });
})(wl);
(function(t) {
  var e = v && v.__createBinding || (Object.create ? function(n, s, a, o) {
    o === void 0 && (o = a);
    var i = Object.getOwnPropertyDescriptor(s, a);
    (!i || ("get" in i ? !s.__esModule : i.writable || i.configurable)) && (i = { enumerable: !0, get: function() {
      return s[a];
    } }), Object.defineProperty(n, o, i);
  } : function(n, s, a, o) {
    o === void 0 && (o = a), n[o] = s[a];
  }), r = v && v.__exportStar || function(n, s) {
    for (var a in n) a !== "default" && !Object.prototype.hasOwnProperty.call(s, a) && e(s, n, a);
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), r(Xe, t), r(wl, t), r(ot, t), r(Te, t), r(ic, t);
})(Lt);
var Ln = {}, Tr = {}, Ha = {};
Object.defineProperty(Ha, "__esModule", { value: !0 });
Ha.LRUCache = void 0;
const lr = typeof performance == "object" && performance && typeof performance.now == "function" ? performance : Date, vl = /* @__PURE__ */ new Set(), Pi = typeof process == "object" && process ? process : {}, bl = (t, e, r, n) => {
  typeof Pi.emitWarning == "function" ? Pi.emitWarning(t, e, r, n) : console.error(`[${r}] ${e}: ${t}`);
};
let ma = globalThis.AbortController, ed = globalThis.AbortSignal;
var jd;
if (typeof ma > "u") {
  ed = class {
    constructor() {
      Z(this, "onabort");
      Z(this, "_onabort", []);
      Z(this, "reason");
      Z(this, "aborted", !1);
    }
    addEventListener(n, s) {
      this._onabort.push(s);
    }
  }, ma = class {
    constructor() {
      Z(this, "signal", new ed());
      e();
    }
    abort(n) {
      var s, a;
      if (!this.signal.aborted) {
        this.signal.reason = n, this.signal.aborted = !0;
        for (const o of this.signal._onabort)
          o(n);
        (a = (s = this.signal).onabort) == null || a.call(s, n);
      }
    }
  };
  let t = ((jd = Pi.env) == null ? void 0 : jd.LRU_CACHE_IGNORE_AC_WARNING) !== "1";
  const e = () => {
    t && (t = !1, bl("AbortController is not defined. If using lru-cache in node 14, load an AbortController polyfill from the `node-abort-controller` package. A minimal polyfill is provided for use by LRUCache.fetch(), but it should not be relied upon in other contexts (eg, passing it to other APIs that use AbortController/AbortSignal might have undesirable effects). You may disable this with LRU_CACHE_IGNORE_AC_WARNING=1 in the env.", "NO_ABORT_CONTROLLER", "ENOTSUP", e));
  };
}
const cg = (t) => !vl.has(t), Ct = (t) => t && t === Math.floor(t) && t > 0 && isFinite(t), Sl = (t) => Ct(t) ? t <= Math.pow(2, 8) ? Uint8Array : t <= Math.pow(2, 16) ? Uint16Array : t <= Math.pow(2, 32) ? Uint32Array : t <= Number.MAX_SAFE_INTEGER ? qs : null : null;
class qs extends Array {
  constructor(e) {
    super(e), this.fill(0);
  }
}
var gr;
const Yt = class Yt {
  constructor(e, r) {
    Z(this, "heap");
    Z(this, "length");
    if (!h(Yt, gr))
      throw new TypeError("instantiate Stack using Stack.create(n)");
    this.heap = new r(e), this.length = 0;
  }
  static create(e) {
    const r = Sl(e);
    if (!r)
      return [];
    k(Yt, gr, !0);
    const n = new Yt(e, r);
    return k(Yt, gr, !1), n;
  }
  push(e) {
    this.heap[this.length++] = e;
  }
  pop() {
    return this.heap[--this.length];
  }
};
gr = new WeakMap(), // private constructor
K(Yt, gr, !1);
let Ii = Yt;
var Dd, zd, Le, ke, Ne, We, wr, vr, ie, He, ne, J, z, Ee, je, we, ue, Je, le, Ze, Fe, De, Be, jt, Ae, P, Oi, Qt, pt, Cn, ze, El, er, br, On, Ot, Tt, Ti, Gs, Ys, H, Ri, cn, Rt, ki;
const vc = class vc {
  constructor(e) {
    K(this, P);
    // options that cannot be changed without disaster
    K(this, Le);
    K(this, ke);
    K(this, Ne);
    K(this, We);
    K(this, wr);
    K(this, vr);
    /**
     * {@link LRUCache.OptionsBase.ttl}
     */
    Z(this, "ttl");
    /**
     * {@link LRUCache.OptionsBase.ttlResolution}
     */
    Z(this, "ttlResolution");
    /**
     * {@link LRUCache.OptionsBase.ttlAutopurge}
     */
    Z(this, "ttlAutopurge");
    /**
     * {@link LRUCache.OptionsBase.updateAgeOnGet}
     */
    Z(this, "updateAgeOnGet");
    /**
     * {@link LRUCache.OptionsBase.updateAgeOnHas}
     */
    Z(this, "updateAgeOnHas");
    /**
     * {@link LRUCache.OptionsBase.allowStale}
     */
    Z(this, "allowStale");
    /**
     * {@link LRUCache.OptionsBase.noDisposeOnSet}
     */
    Z(this, "noDisposeOnSet");
    /**
     * {@link LRUCache.OptionsBase.noUpdateTTL}
     */
    Z(this, "noUpdateTTL");
    /**
     * {@link LRUCache.OptionsBase.maxEntrySize}
     */
    Z(this, "maxEntrySize");
    /**
     * {@link LRUCache.OptionsBase.sizeCalculation}
     */
    Z(this, "sizeCalculation");
    /**
     * {@link LRUCache.OptionsBase.noDeleteOnFetchRejection}
     */
    Z(this, "noDeleteOnFetchRejection");
    /**
     * {@link LRUCache.OptionsBase.noDeleteOnStaleGet}
     */
    Z(this, "noDeleteOnStaleGet");
    /**
     * {@link LRUCache.OptionsBase.allowStaleOnFetchAbort}
     */
    Z(this, "allowStaleOnFetchAbort");
    /**
     * {@link LRUCache.OptionsBase.allowStaleOnFetchRejection}
     */
    Z(this, "allowStaleOnFetchRejection");
    /**
     * {@link LRUCache.OptionsBase.ignoreFetchAbort}
     */
    Z(this, "ignoreFetchAbort");
    // computed properties
    K(this, ie);
    K(this, He);
    K(this, ne);
    K(this, J);
    K(this, z);
    K(this, Ee);
    K(this, je);
    K(this, we);
    K(this, ue);
    K(this, Je);
    K(this, le);
    K(this, Ze);
    K(this, Fe);
    K(this, De);
    K(this, Be);
    K(this, jt);
    K(this, Ae);
    // conditionally set private methods related to TTL
    K(this, Qt, () => {
    });
    K(this, pt, () => {
    });
    K(this, Cn, () => {
    });
    /* c8 ignore stop */
    K(this, ze, () => !1);
    K(this, er, (e) => {
    });
    K(this, br, (e, r, n) => {
    });
    K(this, On, (e, r, n, s) => {
      if (n || s)
        throw new TypeError("cannot set size without setting maxSize or maxEntrySize on cache");
      return 0;
    });
    /**
     * A String value that is used in the creation of the default string
     * description of an object. Called by the built-in method
     * `Object.prototype.toString`.
     */
    Z(this, Dd, "LRUCache");
    const { max: r = 0, ttl: n, ttlResolution: s = 1, ttlAutopurge: a, updateAgeOnGet: o, updateAgeOnHas: i, allowStale: c, dispose: d, disposeAfter: u, noDisposeOnSet: l, noUpdateTTL: p, maxSize: f = 0, maxEntrySize: _ = 0, sizeCalculation: g, fetchMethod: S, memoMethod: w, noDeleteOnFetchRejection: b, noDeleteOnStaleGet: D, allowStaleOnFetchRejection: N, allowStaleOnFetchAbort: oe, ignoreFetchAbort: Ce } = e;
    if (r !== 0 && !Ct(r))
      throw new TypeError("max option must be a nonnegative integer");
    const T = r ? Sl(r) : Array;
    if (!T)
      throw new Error("invalid max value: " + r);
    if (k(this, Le, r), k(this, ke, f), this.maxEntrySize = _ || h(this, ke), this.sizeCalculation = g, this.sizeCalculation) {
      if (!h(this, ke) && !this.maxEntrySize)
        throw new TypeError("cannot set sizeCalculation without setting maxSize or maxEntrySize");
      if (typeof this.sizeCalculation != "function")
        throw new TypeError("sizeCalculation set to non-function");
    }
    if (w !== void 0 && typeof w != "function")
      throw new TypeError("memoMethod must be a function if defined");
    if (k(this, vr, w), S !== void 0 && typeof S != "function")
      throw new TypeError("fetchMethod must be a function if specified");
    if (k(this, wr, S), k(this, jt, !!S), k(this, ne, /* @__PURE__ */ new Map()), k(this, J, new Array(r).fill(void 0)), k(this, z, new Array(r).fill(void 0)), k(this, Ee, new T(r)), k(this, je, new T(r)), k(this, we, 0), k(this, ue, 0), k(this, Je, Ii.create(r)), k(this, ie, 0), k(this, He, 0), typeof d == "function" && k(this, Ne, d), typeof u == "function" ? (k(this, We, u), k(this, le, [])) : (k(this, We, void 0), k(this, le, void 0)), k(this, Be, !!h(this, Ne)), k(this, Ae, !!h(this, We)), this.noDisposeOnSet = !!l, this.noUpdateTTL = !!p, this.noDeleteOnFetchRejection = !!b, this.allowStaleOnFetchRejection = !!N, this.allowStaleOnFetchAbort = !!oe, this.ignoreFetchAbort = !!Ce, this.maxEntrySize !== 0) {
      if (h(this, ke) !== 0 && !Ct(h(this, ke)))
        throw new TypeError("maxSize must be a positive integer if specified");
      if (!Ct(this.maxEntrySize))
        throw new TypeError("maxEntrySize must be a positive integer if specified");
      I(this, P, El).call(this);
    }
    if (this.allowStale = !!c, this.noDeleteOnStaleGet = !!D, this.updateAgeOnGet = !!o, this.updateAgeOnHas = !!i, this.ttlResolution = Ct(s) || s === 0 ? s : 1, this.ttlAutopurge = !!a, this.ttl = n || 0, this.ttl) {
      if (!Ct(this.ttl))
        throw new TypeError("ttl must be a positive integer if specified");
      I(this, P, Oi).call(this);
    }
    if (h(this, Le) === 0 && this.ttl === 0 && h(this, ke) === 0)
      throw new TypeError("At least one of max, maxSize, or ttl is required");
    if (!this.ttlAutopurge && !h(this, Le) && !h(this, ke)) {
      const F = "LRU_CACHE_UNBOUNDED";
      cg(F) && (vl.add(F), bl("TTL caching without ttlAutopurge, max, or maxSize can result in unbounded memory consumption.", "UnboundedCacheWarning", F, vc));
    }
  }
  /**
   * Do not call this method unless you need to inspect the
   * inner workings of the cache.  If anything returned by this
   * object is modified in any way, strange breakage may occur.
   *
   * These fields are private for a reason!
   *
   * @internal
   */
  static unsafeExposeInternals(e) {
    return {
      // properties
      starts: h(e, Fe),
      ttls: h(e, De),
      sizes: h(e, Ze),
      keyMap: h(e, ne),
      keyList: h(e, J),
      valList: h(e, z),
      next: h(e, Ee),
      prev: h(e, je),
      get head() {
        return h(e, we);
      },
      get tail() {
        return h(e, ue);
      },
      free: h(e, Je),
      // methods
      isBackgroundFetch: (r) => {
        var n;
        return I(n = e, P, H).call(n, r);
      },
      backgroundFetch: (r, n, s, a) => {
        var o;
        return I(o = e, P, Ys).call(o, r, n, s, a);
      },
      moveToTail: (r) => {
        var n;
        return I(n = e, P, cn).call(n, r);
      },
      indexes: (r) => {
        var n;
        return I(n = e, P, Ot).call(n, r);
      },
      rindexes: (r) => {
        var n;
        return I(n = e, P, Tt).call(n, r);
      },
      isStale: (r) => {
        var n;
        return h(n = e, ze).call(n, r);
      }
    };
  }
  // Protected read-only members
  /**
   * {@link LRUCache.OptionsBase.max} (read-only)
   */
  get max() {
    return h(this, Le);
  }
  /**
   * {@link LRUCache.OptionsBase.maxSize} (read-only)
   */
  get maxSize() {
    return h(this, ke);
  }
  /**
   * The total computed size of items in the cache (read-only)
   */
  get calculatedSize() {
    return h(this, He);
  }
  /**
   * The number of items stored in the cache (read-only)
   */
  get size() {
    return h(this, ie);
  }
  /**
   * {@link LRUCache.OptionsBase.fetchMethod} (read-only)
   */
  get fetchMethod() {
    return h(this, wr);
  }
  get memoMethod() {
    return h(this, vr);
  }
  /**
   * {@link LRUCache.OptionsBase.dispose} (read-only)
   */
  get dispose() {
    return h(this, Ne);
  }
  /**
   * {@link LRUCache.OptionsBase.disposeAfter} (read-only)
   */
  get disposeAfter() {
    return h(this, We);
  }
  /**
   * Return the number of ms left in the item's TTL. If item is not in cache,
   * returns `0`. Returns `Infinity` if item is in cache without a defined TTL.
   */
  getRemainingTTL(e) {
    return h(this, ne).has(e) ? 1 / 0 : 0;
  }
  /**
   * Return a generator yielding `[key, value]` pairs,
   * in order from most recently used to least recently used.
   */
  *entries() {
    for (const e of I(this, P, Ot).call(this))
      h(this, z)[e] !== void 0 && h(this, J)[e] !== void 0 && !I(this, P, H).call(this, h(this, z)[e]) && (yield [h(this, J)[e], h(this, z)[e]]);
  }
  /**
   * Inverse order version of {@link LRUCache.entries}
   *
   * Return a generator yielding `[key, value]` pairs,
   * in order from least recently used to most recently used.
   */
  *rentries() {
    for (const e of I(this, P, Tt).call(this))
      h(this, z)[e] !== void 0 && h(this, J)[e] !== void 0 && !I(this, P, H).call(this, h(this, z)[e]) && (yield [h(this, J)[e], h(this, z)[e]]);
  }
  /**
   * Return a generator yielding the keys in the cache,
   * in order from most recently used to least recently used.
   */
  *keys() {
    for (const e of I(this, P, Ot).call(this)) {
      const r = h(this, J)[e];
      r !== void 0 && !I(this, P, H).call(this, h(this, z)[e]) && (yield r);
    }
  }
  /**
   * Inverse order version of {@link LRUCache.keys}
   *
   * Return a generator yielding the keys in the cache,
   * in order from least recently used to most recently used.
   */
  *rkeys() {
    for (const e of I(this, P, Tt).call(this)) {
      const r = h(this, J)[e];
      r !== void 0 && !I(this, P, H).call(this, h(this, z)[e]) && (yield r);
    }
  }
  /**
   * Return a generator yielding the values in the cache,
   * in order from most recently used to least recently used.
   */
  *values() {
    for (const e of I(this, P, Ot).call(this))
      h(this, z)[e] !== void 0 && !I(this, P, H).call(this, h(this, z)[e]) && (yield h(this, z)[e]);
  }
  /**
   * Inverse order version of {@link LRUCache.values}
   *
   * Return a generator yielding the values in the cache,
   * in order from least recently used to most recently used.
   */
  *rvalues() {
    for (const e of I(this, P, Tt).call(this))
      h(this, z)[e] !== void 0 && !I(this, P, H).call(this, h(this, z)[e]) && (yield h(this, z)[e]);
  }
  /**
   * Iterating over the cache itself yields the same results as
   * {@link LRUCache.entries}
   */
  [(zd = Symbol.iterator, Dd = Symbol.toStringTag, zd)]() {
    return this.entries();
  }
  /**
   * Find a value for which the supplied fn method returns a truthy value,
   * similar to `Array.find()`. fn is called as `fn(value, key, cache)`.
   */
  find(e, r = {}) {
    for (const n of I(this, P, Ot).call(this)) {
      const s = h(this, z)[n], a = I(this, P, H).call(this, s) ? s.__staleWhileFetching : s;
      if (a !== void 0 && e(a, h(this, J)[n], this))
        return this.get(h(this, J)[n], r);
    }
  }
  /**
   * Call the supplied function on each item in the cache, in order from most
   * recently used to least recently used.
   *
   * `fn` is called as `fn(value, key, cache)`.
   *
   * If `thisp` is provided, function will be called in the `this`-context of
   * the provided object, or the cache if no `thisp` object is provided.
   *
   * Does not update age or recenty of use, or iterate over stale values.
   */
  forEach(e, r = this) {
    for (const n of I(this, P, Ot).call(this)) {
      const s = h(this, z)[n], a = I(this, P, H).call(this, s) ? s.__staleWhileFetching : s;
      a !== void 0 && e.call(r, a, h(this, J)[n], this);
    }
  }
  /**
   * The same as {@link LRUCache.forEach} but items are iterated over in
   * reverse order.  (ie, less recently used items are iterated over first.)
   */
  rforEach(e, r = this) {
    for (const n of I(this, P, Tt).call(this)) {
      const s = h(this, z)[n], a = I(this, P, H).call(this, s) ? s.__staleWhileFetching : s;
      a !== void 0 && e.call(r, a, h(this, J)[n], this);
    }
  }
  /**
   * Delete any stale entries. Returns true if anything was removed,
   * false otherwise.
   */
  purgeStale() {
    let e = !1;
    for (const r of I(this, P, Tt).call(this, { allowStale: !0 }))
      h(this, ze).call(this, r) && (I(this, P, Rt).call(this, h(this, J)[r], "expire"), e = !0);
    return e;
  }
  /**
   * Get the extended info about a given entry, to get its value, size, and
   * TTL info simultaneously. Returns `undefined` if the key is not present.
   *
   * Unlike {@link LRUCache#dump}, which is designed to be portable and survive
   * serialization, the `start` value is always the current timestamp, and the
   * `ttl` is a calculated remaining time to live (negative if expired).
   *
   * Always returns stale values, if their info is found in the cache, so be
   * sure to check for expirations (ie, a negative {@link LRUCache.Entry#ttl})
   * if relevant.
   */
  info(e) {
    const r = h(this, ne).get(e);
    if (r === void 0)
      return;
    const n = h(this, z)[r], s = I(this, P, H).call(this, n) ? n.__staleWhileFetching : n;
    if (s === void 0)
      return;
    const a = { value: s };
    if (h(this, De) && h(this, Fe)) {
      const o = h(this, De)[r], i = h(this, Fe)[r];
      if (o && i) {
        const c = o - (lr.now() - i);
        a.ttl = c, a.start = Date.now();
      }
    }
    return h(this, Ze) && (a.size = h(this, Ze)[r]), a;
  }
  /**
   * Return an array of [key, {@link LRUCache.Entry}] tuples which can be
   * passed to {@link LRLUCache#load}.
   *
   * The `start` fields are calculated relative to a portable `Date.now()`
   * timestamp, even if `performance.now()` is available.
   *
   * Stale entries are always included in the `dump`, even if
   * {@link LRUCache.OptionsBase.allowStale} is false.
   *
   * Note: this returns an actual array, not a generator, so it can be more
   * easily passed around.
   */
  dump() {
    const e = [];
    for (const r of I(this, P, Ot).call(this, { allowStale: !0 })) {
      const n = h(this, J)[r], s = h(this, z)[r], a = I(this, P, H).call(this, s) ? s.__staleWhileFetching : s;
      if (a === void 0 || n === void 0)
        continue;
      const o = { value: a };
      if (h(this, De) && h(this, Fe)) {
        o.ttl = h(this, De)[r];
        const i = lr.now() - h(this, Fe)[r];
        o.start = Math.floor(Date.now() - i);
      }
      h(this, Ze) && (o.size = h(this, Ze)[r]), e.unshift([n, o]);
    }
    return e;
  }
  /**
   * Reset the cache and load in the items in entries in the order listed.
   *
   * The shape of the resulting cache may be different if the same options are
   * not used in both caches.
   *
   * The `start` fields are assumed to be calculated relative to a portable
   * `Date.now()` timestamp, even if `performance.now()` is available.
   */
  load(e) {
    this.clear();
    for (const [r, n] of e) {
      if (n.start) {
        const s = Date.now() - n.start;
        n.start = lr.now() - s;
      }
      this.set(r, n.value, n);
    }
  }
  /**
   * Add a value to the cache.
   *
   * Note: if `undefined` is specified as a value, this is an alias for
   * {@link LRUCache#delete}
   *
   * Fields on the {@link LRUCache.SetOptions} options param will override
   * their corresponding values in the constructor options for the scope
   * of this single `set()` operation.
   *
   * If `start` is provided, then that will set the effective start
   * time for the TTL calculation. Note that this must be a previous
   * value of `performance.now()` if supported, or a previous value of
   * `Date.now()` if not.
   *
   * Options object may also include `size`, which will prevent
   * calling the `sizeCalculation` function and just use the specified
   * number if it is a positive integer, and `noDisposeOnSet` which
   * will prevent calling a `dispose` function in the case of
   * overwrites.
   *
   * If the `size` (or return value of `sizeCalculation`) for a given
   * entry is greater than `maxEntrySize`, then the item will not be
   * added to the cache.
   *
   * Will update the recency of the entry.
   *
   * If the value is `undefined`, then this is an alias for
   * `cache.delete(key)`. `undefined` is never stored in the cache.
   */
  set(e, r, n = {}) {
    var p, f, _, g, S;
    if (r === void 0)
      return this.delete(e), this;
    const { ttl: s = this.ttl, start: a, noDisposeOnSet: o = this.noDisposeOnSet, sizeCalculation: i = this.sizeCalculation, status: c } = n;
    let { noUpdateTTL: d = this.noUpdateTTL } = n;
    const u = h(this, On).call(this, e, r, n.size || 0, i);
    if (this.maxEntrySize && u > this.maxEntrySize)
      return c && (c.set = "miss", c.maxEntrySizeExceeded = !0), I(this, P, Rt).call(this, e, "set"), this;
    let l = h(this, ie) === 0 ? void 0 : h(this, ne).get(e);
    if (l === void 0)
      l = h(this, ie) === 0 ? h(this, ue) : h(this, Je).length !== 0 ? h(this, Je).pop() : h(this, ie) === h(this, Le) ? I(this, P, Gs).call(this, !1) : h(this, ie), h(this, J)[l] = e, h(this, z)[l] = r, h(this, ne).set(e, l), h(this, Ee)[h(this, ue)] = l, h(this, je)[l] = h(this, ue), k(this, ue, l), Cs(this, ie)._++, h(this, br).call(this, l, u, c), c && (c.set = "add"), d = !1;
    else {
      I(this, P, cn).call(this, l);
      const w = h(this, z)[l];
      if (r !== w) {
        if (h(this, jt) && I(this, P, H).call(this, w)) {
          w.__abortController.abort(new Error("replaced"));
          const { __staleWhileFetching: b } = w;
          b !== void 0 && !o && (h(this, Be) && ((p = h(this, Ne)) == null || p.call(this, b, e, "set")), h(this, Ae) && ((f = h(this, le)) == null || f.push([b, e, "set"])));
        } else o || (h(this, Be) && ((_ = h(this, Ne)) == null || _.call(this, w, e, "set")), h(this, Ae) && ((g = h(this, le)) == null || g.push([w, e, "set"])));
        if (h(this, er).call(this, l), h(this, br).call(this, l, u, c), h(this, z)[l] = r, c) {
          c.set = "replace";
          const b = w && I(this, P, H).call(this, w) ? w.__staleWhileFetching : w;
          b !== void 0 && (c.oldValue = b);
        }
      } else c && (c.set = "update");
    }
    if (s !== 0 && !h(this, De) && I(this, P, Oi).call(this), h(this, De) && (d || h(this, Cn).call(this, l, s, a), c && h(this, pt).call(this, c, l)), !o && h(this, Ae) && h(this, le)) {
      const w = h(this, le);
      let b;
      for (; b = w == null ? void 0 : w.shift(); )
        (S = h(this, We)) == null || S.call(this, ...b);
    }
    return this;
  }
  /**
   * Evict the least recently used item, returning its value or
   * `undefined` if cache is empty.
   */
  pop() {
    var e;
    try {
      for (; h(this, ie); ) {
        const r = h(this, z)[h(this, we)];
        if (I(this, P, Gs).call(this, !0), I(this, P, H).call(this, r)) {
          if (r.__staleWhileFetching)
            return r.__staleWhileFetching;
        } else if (r !== void 0)
          return r;
      }
    } finally {
      if (h(this, Ae) && h(this, le)) {
        const r = h(this, le);
        let n;
        for (; n = r == null ? void 0 : r.shift(); )
          (e = h(this, We)) == null || e.call(this, ...n);
      }
    }
  }
  /**
   * Check if a key is in the cache, without updating the recency of use.
   * Will return false if the item is stale, even though it is technically
   * in the cache.
   *
   * Check if a key is in the cache, without updating the recency of
   * use. Age is updated if {@link LRUCache.OptionsBase.updateAgeOnHas} is set
   * to `true` in either the options or the constructor.
   *
   * Will return `false` if the item is stale, even though it is technically in
   * the cache. The difference can be determined (if it matters) by using a
   * `status` argument, and inspecting the `has` field.
   *
   * Will not update item age unless
   * {@link LRUCache.OptionsBase.updateAgeOnHas} is set.
   */
  has(e, r = {}) {
    const { updateAgeOnHas: n = this.updateAgeOnHas, status: s } = r, a = h(this, ne).get(e);
    if (a !== void 0) {
      const o = h(this, z)[a];
      if (I(this, P, H).call(this, o) && o.__staleWhileFetching === void 0)
        return !1;
      if (h(this, ze).call(this, a))
        s && (s.has = "stale", h(this, pt).call(this, s, a));
      else return n && h(this, Qt).call(this, a), s && (s.has = "hit", h(this, pt).call(this, s, a)), !0;
    } else s && (s.has = "miss");
    return !1;
  }
  /**
   * Like {@link LRUCache#get} but doesn't update recency or delete stale
   * items.
   *
   * Returns `undefined` if the item is stale, unless
   * {@link LRUCache.OptionsBase.allowStale} is set.
   */
  peek(e, r = {}) {
    const { allowStale: n = this.allowStale } = r, s = h(this, ne).get(e);
    if (s === void 0 || !n && h(this, ze).call(this, s))
      return;
    const a = h(this, z)[s];
    return I(this, P, H).call(this, a) ? a.__staleWhileFetching : a;
  }
  async fetch(e, r = {}) {
    const {
      // get options
      allowStale: n = this.allowStale,
      updateAgeOnGet: s = this.updateAgeOnGet,
      noDeleteOnStaleGet: a = this.noDeleteOnStaleGet,
      // set options
      ttl: o = this.ttl,
      noDisposeOnSet: i = this.noDisposeOnSet,
      size: c = 0,
      sizeCalculation: d = this.sizeCalculation,
      noUpdateTTL: u = this.noUpdateTTL,
      // fetch exclusive options
      noDeleteOnFetchRejection: l = this.noDeleteOnFetchRejection,
      allowStaleOnFetchRejection: p = this.allowStaleOnFetchRejection,
      ignoreFetchAbort: f = this.ignoreFetchAbort,
      allowStaleOnFetchAbort: _ = this.allowStaleOnFetchAbort,
      context: g,
      forceRefresh: S = !1,
      status: w,
      signal: b
    } = r;
    if (!h(this, jt))
      return w && (w.fetch = "get"), this.get(e, {
        allowStale: n,
        updateAgeOnGet: s,
        noDeleteOnStaleGet: a,
        status: w
      });
    const D = {
      allowStale: n,
      updateAgeOnGet: s,
      noDeleteOnStaleGet: a,
      ttl: o,
      noDisposeOnSet: i,
      size: c,
      sizeCalculation: d,
      noUpdateTTL: u,
      noDeleteOnFetchRejection: l,
      allowStaleOnFetchRejection: p,
      allowStaleOnFetchAbort: _,
      ignoreFetchAbort: f,
      status: w,
      signal: b
    };
    let N = h(this, ne).get(e);
    if (N === void 0) {
      w && (w.fetch = "miss");
      const oe = I(this, P, Ys).call(this, e, N, D, g);
      return oe.__returned = oe;
    } else {
      const oe = h(this, z)[N];
      if (I(this, P, H).call(this, oe)) {
        const pe = n && oe.__staleWhileFetching !== void 0;
        return w && (w.fetch = "inflight", pe && (w.returnedStale = !0)), pe ? oe.__staleWhileFetching : oe.__returned = oe;
      }
      const Ce = h(this, ze).call(this, N);
      if (!S && !Ce)
        return w && (w.fetch = "hit"), I(this, P, cn).call(this, N), s && h(this, Qt).call(this, N), w && h(this, pt).call(this, w, N), oe;
      const T = I(this, P, Ys).call(this, e, N, D, g), W = T.__staleWhileFetching !== void 0 && n;
      return w && (w.fetch = Ce ? "stale" : "refresh", W && Ce && (w.returnedStale = !0)), W ? T.__staleWhileFetching : T.__returned = T;
    }
  }
  async forceFetch(e, r = {}) {
    const n = await this.fetch(e, r);
    if (n === void 0)
      throw new Error("fetch() returned undefined");
    return n;
  }
  memo(e, r = {}) {
    const n = h(this, vr);
    if (!n)
      throw new Error("no memoMethod provided to constructor");
    const { context: s, forceRefresh: a, ...o } = r, i = this.get(e, o);
    if (!a && i !== void 0)
      return i;
    const c = n(e, i, {
      options: o,
      context: s
    });
    return this.set(e, c, o), c;
  }
  /**
   * Return a value from the cache. Will update the recency of the cache
   * entry found.
   *
   * If the key is not found, get() will return `undefined`.
   */
  get(e, r = {}) {
    const { allowStale: n = this.allowStale, updateAgeOnGet: s = this.updateAgeOnGet, noDeleteOnStaleGet: a = this.noDeleteOnStaleGet, status: o } = r, i = h(this, ne).get(e);
    if (i !== void 0) {
      const c = h(this, z)[i], d = I(this, P, H).call(this, c);
      return o && h(this, pt).call(this, o, i), h(this, ze).call(this, i) ? (o && (o.get = "stale"), d ? (o && n && c.__staleWhileFetching !== void 0 && (o.returnedStale = !0), n ? c.__staleWhileFetching : void 0) : (a || I(this, P, Rt).call(this, e, "expire"), o && n && (o.returnedStale = !0), n ? c : void 0)) : (o && (o.get = "hit"), d ? c.__staleWhileFetching : (I(this, P, cn).call(this, i), s && h(this, Qt).call(this, i), c));
    } else o && (o.get = "miss");
  }
  /**
   * Deletes a key out of the cache.
   *
   * Returns true if the key was deleted, false otherwise.
   */
  delete(e) {
    return I(this, P, Rt).call(this, e, "delete");
  }
  /**
   * Clear the cache entirely, throwing away all values.
   */
  clear() {
    return I(this, P, ki).call(this, "delete");
  }
};
Le = new WeakMap(), ke = new WeakMap(), Ne = new WeakMap(), We = new WeakMap(), wr = new WeakMap(), vr = new WeakMap(), ie = new WeakMap(), He = new WeakMap(), ne = new WeakMap(), J = new WeakMap(), z = new WeakMap(), Ee = new WeakMap(), je = new WeakMap(), we = new WeakMap(), ue = new WeakMap(), Je = new WeakMap(), le = new WeakMap(), Ze = new WeakMap(), Fe = new WeakMap(), De = new WeakMap(), Be = new WeakMap(), jt = new WeakMap(), Ae = new WeakMap(), P = new WeakSet(), Oi = function() {
  const e = new qs(h(this, Le)), r = new qs(h(this, Le));
  k(this, De, e), k(this, Fe, r), k(this, Cn, (a, o, i = lr.now()) => {
    if (r[a] = o !== 0 ? i : 0, e[a] = o, o !== 0 && this.ttlAutopurge) {
      const c = setTimeout(() => {
        h(this, ze).call(this, a) && I(this, P, Rt).call(this, h(this, J)[a], "expire");
      }, o + 1);
      c.unref && c.unref();
    }
  }), k(this, Qt, (a) => {
    r[a] = e[a] !== 0 ? lr.now() : 0;
  }), k(this, pt, (a, o) => {
    if (e[o]) {
      const i = e[o], c = r[o];
      if (!i || !c)
        return;
      a.ttl = i, a.start = c, a.now = n || s();
      const d = a.now - c;
      a.remainingTTL = i - d;
    }
  });
  let n = 0;
  const s = () => {
    const a = lr.now();
    if (this.ttlResolution > 0) {
      n = a;
      const o = setTimeout(() => n = 0, this.ttlResolution);
      o.unref && o.unref();
    }
    return a;
  };
  this.getRemainingTTL = (a) => {
    const o = h(this, ne).get(a);
    if (o === void 0)
      return 0;
    const i = e[o], c = r[o];
    if (!i || !c)
      return 1 / 0;
    const d = (n || s()) - c;
    return i - d;
  }, k(this, ze, (a) => {
    const o = r[a], i = e[a];
    return !!i && !!o && (n || s()) - o > i;
  });
}, Qt = new WeakMap(), pt = new WeakMap(), Cn = new WeakMap(), ze = new WeakMap(), El = function() {
  const e = new qs(h(this, Le));
  k(this, He, 0), k(this, Ze, e), k(this, er, (r) => {
    k(this, He, h(this, He) - e[r]), e[r] = 0;
  }), k(this, On, (r, n, s, a) => {
    if (I(this, P, H).call(this, n))
      return 0;
    if (!Ct(s))
      if (a) {
        if (typeof a != "function")
          throw new TypeError("sizeCalculation must be a function");
        if (s = a(n, r), !Ct(s))
          throw new TypeError("sizeCalculation return invalid (expect positive integer)");
      } else
        throw new TypeError("invalid size value (must be positive integer). When maxSize or maxEntrySize is used, sizeCalculation or size must be set.");
    return s;
  }), k(this, br, (r, n, s) => {
    if (e[r] = n, h(this, ke)) {
      const a = h(this, ke) - e[r];
      for (; h(this, He) > a; )
        I(this, P, Gs).call(this, !0);
    }
    k(this, He, h(this, He) + e[r]), s && (s.entrySize = n, s.totalCalculatedSize = h(this, He));
  });
}, er = new WeakMap(), br = new WeakMap(), On = new WeakMap(), Ot = function* ({ allowStale: e = this.allowStale } = {}) {
  if (h(this, ie))
    for (let r = h(this, ue); !(!I(this, P, Ti).call(this, r) || ((e || !h(this, ze).call(this, r)) && (yield r), r === h(this, we))); )
      r = h(this, je)[r];
}, Tt = function* ({ allowStale: e = this.allowStale } = {}) {
  if (h(this, ie))
    for (let r = h(this, we); !(!I(this, P, Ti).call(this, r) || ((e || !h(this, ze).call(this, r)) && (yield r), r === h(this, ue))); )
      r = h(this, Ee)[r];
}, Ti = function(e) {
  return e !== void 0 && h(this, ne).get(h(this, J)[e]) === e;
}, Gs = function(e) {
  var a, o;
  const r = h(this, we), n = h(this, J)[r], s = h(this, z)[r];
  return h(this, jt) && I(this, P, H).call(this, s) ? s.__abortController.abort(new Error("evicted")) : (h(this, Be) || h(this, Ae)) && (h(this, Be) && ((a = h(this, Ne)) == null || a.call(this, s, n, "evict")), h(this, Ae) && ((o = h(this, le)) == null || o.push([s, n, "evict"]))), h(this, er).call(this, r), e && (h(this, J)[r] = void 0, h(this, z)[r] = void 0, h(this, Je).push(r)), h(this, ie) === 1 ? (k(this, we, k(this, ue, 0)), h(this, Je).length = 0) : k(this, we, h(this, Ee)[r]), h(this, ne).delete(n), Cs(this, ie)._--, r;
}, Ys = function(e, r, n, s) {
  const a = r === void 0 ? void 0 : h(this, z)[r];
  if (I(this, P, H).call(this, a))
    return a;
  const o = new ma(), { signal: i } = n;
  i == null || i.addEventListener("abort", () => o.abort(i.reason), {
    signal: o.signal
  });
  const c = {
    signal: o.signal,
    options: n,
    context: s
  }, d = (g, S = !1) => {
    const { aborted: w } = o.signal, b = n.ignoreFetchAbort && g !== void 0;
    if (n.status && (w && !S ? (n.status.fetchAborted = !0, n.status.fetchError = o.signal.reason, b && (n.status.fetchAbortIgnored = !0)) : n.status.fetchResolved = !0), w && !b && !S)
      return l(o.signal.reason);
    const D = f;
    return h(this, z)[r] === f && (g === void 0 ? D.__staleWhileFetching ? h(this, z)[r] = D.__staleWhileFetching : I(this, P, Rt).call(this, e, "fetch") : (n.status && (n.status.fetchUpdated = !0), this.set(e, g, c.options))), g;
  }, u = (g) => (n.status && (n.status.fetchRejected = !0, n.status.fetchError = g), l(g)), l = (g) => {
    const { aborted: S } = o.signal, w = S && n.allowStaleOnFetchAbort, b = w || n.allowStaleOnFetchRejection, D = b || n.noDeleteOnFetchRejection, N = f;
    if (h(this, z)[r] === f && (!D || N.__staleWhileFetching === void 0 ? I(this, P, Rt).call(this, e, "fetch") : w || (h(this, z)[r] = N.__staleWhileFetching)), b)
      return n.status && N.__staleWhileFetching !== void 0 && (n.status.returnedStale = !0), N.__staleWhileFetching;
    if (N.__returned === N)
      throw g;
  }, p = (g, S) => {
    var b;
    const w = (b = h(this, wr)) == null ? void 0 : b.call(this, e, a, c);
    w && w instanceof Promise && w.then((D) => g(D === void 0 ? void 0 : D), S), o.signal.addEventListener("abort", () => {
      (!n.ignoreFetchAbort || n.allowStaleOnFetchAbort) && (g(void 0), n.allowStaleOnFetchAbort && (g = (D) => d(D, !0)));
    });
  };
  n.status && (n.status.fetchDispatched = !0);
  const f = new Promise(p).then(d, u), _ = Object.assign(f, {
    __abortController: o,
    __staleWhileFetching: a,
    __returned: void 0
  });
  return r === void 0 ? (this.set(e, _, { ...c.options, status: void 0 }), r = h(this, ne).get(e)) : h(this, z)[r] = _, _;
}, H = function(e) {
  if (!h(this, jt))
    return !1;
  const r = e;
  return !!r && r instanceof Promise && r.hasOwnProperty("__staleWhileFetching") && r.__abortController instanceof ma;
}, Ri = function(e, r) {
  h(this, je)[r] = e, h(this, Ee)[e] = r;
}, cn = function(e) {
  e !== h(this, ue) && (e === h(this, we) ? k(this, we, h(this, Ee)[e]) : I(this, P, Ri).call(this, h(this, je)[e], h(this, Ee)[e]), I(this, P, Ri).call(this, h(this, ue), e), k(this, ue, e));
}, Rt = function(e, r) {
  var s, a, o, i;
  let n = !1;
  if (h(this, ie) !== 0) {
    const c = h(this, ne).get(e);
    if (c !== void 0)
      if (n = !0, h(this, ie) === 1)
        I(this, P, ki).call(this, r);
      else {
        h(this, er).call(this, c);
        const d = h(this, z)[c];
        if (I(this, P, H).call(this, d) ? d.__abortController.abort(new Error("deleted")) : (h(this, Be) || h(this, Ae)) && (h(this, Be) && ((s = h(this, Ne)) == null || s.call(this, d, e, r)), h(this, Ae) && ((a = h(this, le)) == null || a.push([d, e, r]))), h(this, ne).delete(e), h(this, J)[c] = void 0, h(this, z)[c] = void 0, c === h(this, ue))
          k(this, ue, h(this, je)[c]);
        else if (c === h(this, we))
          k(this, we, h(this, Ee)[c]);
        else {
          const u = h(this, je)[c];
          h(this, Ee)[u] = h(this, Ee)[c];
          const l = h(this, Ee)[c];
          h(this, je)[l] = h(this, je)[c];
        }
        Cs(this, ie)._--, h(this, Je).push(c);
      }
  }
  if (h(this, Ae) && ((o = h(this, le)) != null && o.length)) {
    const c = h(this, le);
    let d;
    for (; d = c == null ? void 0 : c.shift(); )
      (i = h(this, We)) == null || i.call(this, ...d);
  }
  return n;
}, ki = function(e) {
  var r, n, s;
  for (const a of I(this, P, Tt).call(this, { allowStale: !0 })) {
    const o = h(this, z)[a];
    if (I(this, P, H).call(this, o))
      o.__abortController.abort(new Error("deleted"));
    else {
      const i = h(this, J)[a];
      h(this, Be) && ((r = h(this, Ne)) == null || r.call(this, o, i, e)), h(this, Ae) && ((n = h(this, le)) == null || n.push([o, i, e]));
    }
  }
  if (h(this, ne).clear(), h(this, z).fill(void 0), h(this, J).fill(void 0), h(this, De) && h(this, Fe) && (h(this, De).fill(0), h(this, Fe).fill(0)), h(this, Ze) && h(this, Ze).fill(0), k(this, we, 0), k(this, ue, 0), h(this, Je).length = 0, k(this, He, 0), k(this, ie, 0), h(this, Ae) && h(this, le)) {
    const a = h(this, le);
    let o;
    for (; o = a == null ? void 0 : a.shift(); )
      (s = h(this, We)) == null || s.call(this, ...o);
  }
};
let Ci = vc;
Ha.LRUCache = Ci;
var dc = {};
Object.defineProperty(dc, "__esModule", { value: !0 });
dc.roughSizeOfObject = dg;
const Go = /* @__PURE__ */ new WeakMap();
function dg(t) {
  const e = /* @__PURE__ */ new Set(), r = [t];
  let n = 0;
  for (; r.length; ) {
    const s = r.pop();
    switch (typeof s) {
      case "string":
        n += 12 + 4 * Math.ceil(s.length / 4);
        break;
      case "number":
        n += 12;
        break;
      case "boolean":
        n += 4;
        break;
      case "object":
        if (n += 4, s === null)
          break;
        if (Go.has(s)) {
          n += Go.get(s);
          break;
        }
        if (e.has(s))
          continue;
        if (e.add(s), Array.isArray(s))
          n += 4, r.push(...s);
        else {
          n += 8;
          const a = Object.getOwnPropertyNames(s);
          for (let o = 0; o < a.length; o++) {
            n += 4;
            const i = a[o], c = s[i];
            c !== void 0 && r.push(c), r.push(i);
          }
        }
        break;
      case "function":
        n += 8;
        break;
      case "symbol":
        n += 8;
        break;
      case "bigint":
        n += 16;
        break;
    }
  }
  return typeof t == "object" && t !== null && Go.set(t, n), n;
}
var ug = v && v.__classPrivateFieldSet || function(t, e, r, n, s) {
  if (n === "m") throw new TypeError("Private method is not writable");
  if (n === "a" && !s) throw new TypeError("Private accessor was defined without a setter");
  if (typeof e == "function" ? t !== e || !s : !e.has(t)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return n === "a" ? s.call(t, r) : s ? s.value = r : e.set(t, r), r;
}, Ms = v && v.__classPrivateFieldGet || function(t, e, r, n) {
  if (r === "a" && !n) throw new TypeError("Private accessor was defined without a getter");
  if (typeof e == "function" ? t !== e || !n : !e.has(t)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return r === "m" ? n : r === "a" ? n.call(t) : n ? n.value : e.get(t);
}, Vt;
Object.defineProperty(Tr, "__esModule", { value: !0 });
Tr.SimpleStoreMemory = void 0;
const lg = Ha, hg = dc, Al = Symbol("nullItem"), fg = (t) => t === null ? Al : t, td = (t) => t === Al ? null : t;
class pg {
  constructor({ sizeCalculation: e, ...r }) {
    Vt.set(this, void 0), ug(this, Vt, new lg.LRUCache({
      ...r,
      allowStale: !1,
      updateAgeOnGet: !1,
      updateAgeOnHas: !1,
      sizeCalculation: e ? (n, s) => e(td(n), s) : r.maxEntrySize != null || r.maxSize != null ? (
        // maxEntrySize and maxSize require a size calculation function.
        hg.roughSizeOfObject
      ) : void 0
    }), "f");
  }
  get(e) {
    const r = Ms(this, Vt, "f").get(e);
    if (r !== void 0)
      return td(r);
  }
  set(e, r) {
    Ms(this, Vt, "f").set(e, fg(r));
  }
  del(e) {
    Ms(this, Vt, "f").delete(e);
  }
  clear() {
    Ms(this, Vt, "f").clear();
  }
}
Tr.SimpleStoreMemory = pg;
Vt = /* @__PURE__ */ new WeakMap();
Object.defineProperty(Ln, "__esModule", { value: !0 });
Ln.DidCacheMemory = void 0;
const yg = Tr, rd = 3600 * 1e3, mg = 50 * 1024 * 1024;
class _g extends yg.SimpleStoreMemory {
  constructor(e) {
    super((e == null ? void 0 : e.max) == null ? { ttl: rd, maxSize: mg, ...e } : { ttl: rd, ...e });
  }
}
Ln.DidCacheMemory = _g;
var Ja = {}, Rr = {}, Za = {};
Object.defineProperty(Za, "__esModule", { value: !0 });
Za.CachedGetter = void 0;
const gg = () => !0, wg = () => !1;
class vg {
  constructor(e, r, n = {}) {
    Object.defineProperty(this, "getter", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: e
    }), Object.defineProperty(this, "store", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: r
    }), Object.defineProperty(this, "options", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: n
    }), Object.defineProperty(this, "pending", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: /* @__PURE__ */ new Map()
    });
  }
  async get(e, { signal: r, context: n, allowStale: s = !1, noCache: a = !1 } = {}) {
    r == null || r.throwIfAborted();
    const { isStale: o, deleteOnError: i } = this.options, c = a ? wg : s || o == null ? gg : async (p) => !await o(e, p);
    let d;
    for (; d = this.pending.get(e); ) {
      try {
        const { isFresh: p, value: f } = await d;
        if (p || await c(f))
          return f;
      } catch {
      }
      r == null || r.throwIfAborted();
    }
    const u = Promise.resolve().then(async () => {
      const p = await this.getStored(e, { signal: r });
      return p !== void 0 && await c(p) ? { isFresh: !1, value: p } : Promise.resolve().then(async () => {
        const f = { signal: r, noCache: a, context: n };
        return this.getter.call(null, e, f, p);
      }).catch(async (f) => {
        if (p !== void 0)
          try {
            await (i == null ? void 0 : i(f, e, p)) && await this.delStored(e, f);
          } catch (_) {
            throw new AggregateError([f, _], "Error while deleting stored value");
          }
        throw f;
      }).then(async (f) => (await this.setStored(e, f), { isFresh: !0, value: f }));
    }).finally(() => {
      this.pending.delete(e);
    });
    if (this.pending.has(e))
      throw new Error("Concurrent request for the same key");
    this.pending.set(e, u);
    const { value: l } = await u;
    return l;
  }
  async getStored(e, r) {
    try {
      return await this.store.get(e, r);
    } catch {
      return;
    }
  }
  async setStored(e, r) {
    var n;
    try {
      await this.store.set(e, r);
    } catch (s) {
      const a = (n = this.options) == null ? void 0 : n.onStoreError;
      await (a == null ? void 0 : a(s, e, r));
    }
  }
  async delStored(e, r) {
    await this.store.del(e);
  }
}
Za.CachedGetter = vg;
var Pl = {};
Object.defineProperty(Pl, "__esModule", { value: !0 });
var Il = {};
Object.defineProperty(Il, "__esModule", { value: !0 });
(function(t) {
  var e = v && v.__createBinding || (Object.create ? function(n, s, a, o) {
    o === void 0 && (o = a);
    var i = Object.getOwnPropertyDescriptor(s, a);
    (!i || ("get" in i ? !s.__esModule : i.writable || i.configurable)) && (i = { enumerable: !0, get: function() {
      return s[a];
    } }), Object.defineProperty(n, o, i);
  } : function(n, s, a, o) {
    o === void 0 && (o = a), n[o] = s[a];
  }), r = v && v.__exportStar || function(n, s) {
    for (var a in n) a !== "default" && !Object.prototype.hasOwnProperty.call(s, a) && e(s, n, a);
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), r(Za, t), r(Pl, t), r(Il, t);
})(Rr);
Object.defineProperty(Ja, "__esModule", { value: !0 });
Ja.DidResolverCached = void 0;
const bg = Rr, Sg = Ln;
class Eg {
  constructor(e, r = new Sg.DidCacheMemory()) {
    Object.defineProperty(this, "getter", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.getter = new bg.CachedGetter((n, s) => e.resolve(n, s), r);
  }
  async resolve(e, r) {
    return this.getter.get(e, r);
  }
}
Ja.DidResolverCached = Eg;
var Cl = {};
Object.defineProperty(Cl, "__esModule", { value: !0 });
var Fa = {}, Ba = {}, ut = {}, kr = {};
Object.defineProperty(kr, "__esModule", { value: !0 });
kr.FetchError = void 0;
class Ag extends Error {
  constructor(e, r, n) {
    super(r, n), Object.defineProperty(this, "statusCode", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: e
    });
  }
  get expose() {
    return !0;
  }
}
kr.FetchError = Ag;
var uc = {}, jr = {};
Object.defineProperty(jr, "__esModule", { value: !0 });
jr.toRequestTransformer = Pg;
jr.asRequest = Ol;
function Pg(t) {
  return function(e, r) {
    return t.call(this, Ol(e, r));
  };
}
function Ol(t, e) {
  return !e && t instanceof Request ? t : new Request(t, e);
}
var ve = {};
Object.defineProperty(ve, "__esModule", { value: !0 });
ve.extractUrl = ve.MaxBytesTransformStream = ve.ifString = void 0;
ve.isIp = Ig;
ve.padLines = Rg;
ve.cancelBody = Tl;
ve.logCancellationError = Rl;
ve.stringifyMessage = kg;
function Ig(t) {
  return !!(t.match(/^\d+\.\d+\.\d+\.\d+$/) || t.startsWith("[") && t.endsWith("]"));
}
const Cg = (t) => typeof t == "string" ? t : void 0;
ve.ifString = Cg;
class Og extends TransformStream {
  constructor(e) {
    if (!(e >= 0))
      throw new TypeError("maxBytes must be a non-negative number");
    let r = 0;
    super({
      transform: (n, s) => {
        (r += n.length) <= e ? s.enqueue(n) : s.error(new Error("Response too large"));
      }
    });
  }
}
ve.MaxBytesTransformStream = Og;
const Tg = /\r?\n/g;
function Rg(t, e) {
  return t && e + t.replace(Tg, `$&${e}`);
}
async function Tl(t, e) {
  t.body && !t.bodyUsed && !t.body.locked && // Support for alternative fetch implementations
  typeof t.body.cancel == "function" && (typeof e == "function" ? t.body.cancel().catch(e) : e === "log" ? t.body.cancel().catch(Rl) : await t.body.cancel());
}
function Rl(t) {
  console.warn("Failed to cancel response body", t);
}
async function kg(t) {
  try {
    const e = jg(t.headers), r = await Dg(t);
    return e && r ? `${e}
${r}` : e || r;
  } finally {
    Tl(t, "log");
  }
}
function jg(t) {
  return Array.from(t).map(([e, r]) => `${e}: ${r}`).join(`
`);
}
async function Dg(t) {
  var e;
  try {
    const r = await t.blob();
    if ((e = r.type) != null && e.startsWith("text/")) {
      const n = await r.text();
      return JSON.stringify(n);
    }
    if (/application\/(?:\w+\+)?json/.test(r.type)) {
      const n = await r.text();
      return n.includes(`
`) ? JSON.stringify(JSON.parse(n)) : n;
    }
    return `[Body size: ${r.size}, type: ${JSON.stringify(r.type)} ]`;
  } catch {
    return "[Body could not be read]";
  }
}
const zg = (t) => typeof t == "string" ? new URL(t) : t instanceof URL ? t : new URL(t.url);
ve.extractUrl = zg;
(function(t) {
  Object.defineProperty(t, "__esModule", { value: !0 }), t.DEFAULT_FORBIDDEN_DOMAIN_NAMES = t.FetchRequestError = void 0, t.protocolCheckRequestTransform = i, t.explicitRedirectCheckRequestTransform = c, t.requireHostHeaderTransform = d, t.forbiddenDomainNameRequestTransform = u;
  const e = kr, r = jr, n = ve;
  class s extends e.FetchError {
    constructor(p, f, _, g) {
      if (f == null || !_) {
        const S = o(a(g == null ? void 0 : g.cause));
        f ?? (f = S[0]), _ || (_ = S[1]);
      }
      super(f, _, g), Object.defineProperty(this, "request", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: p
      });
    }
    get expose() {
      return this.statusCode !== 500;
    }
    static from(p, f) {
      return f instanceof s ? f : new s(p, void 0, void 0, { cause: f });
    }
  }
  t.FetchRequestError = s;
  function a(l) {
    return l instanceof TypeError && l.message === "fetch failed" && l.cause !== void 0 ? l.cause : l;
  }
  function o(l) {
    if (typeof l == "string" && l.length > 0)
      return [500, l];
    if (!(l instanceof Error))
      return [500, "Failed to fetch"];
    switch (l.message) {
      case "failed to fetch the data URL":
        return [400, l.message];
      case "unexpected redirect":
      case "cors failure":
      case "blocked":
      case "proxy authentication required":
        return [502, l.message];
    }
    const p = l.code;
    if (typeof p == "string")
      switch (!0) {
        case p === "ENOTFOUND":
          return [400, "Invalid hostname"];
        case p === "ECONNREFUSED":
          return [502, "Connection refused"];
        case p === "DEPTH_ZERO_SELF_SIGNED_CERT":
          return [502, "Self-signed certificate"];
        case p.startsWith("ERR_TLS"):
          return [502, "TLS error"];
        case p.startsWith("ECONN"):
          return [502, "Connection error"];
        default:
          return [500, `${p} error`];
      }
    return [500, l.message];
  }
  function i(l) {
    return (p, f) => {
      const { protocol: _, port: g } = (0, n.extractUrl)(p), S = (0, r.asRequest)(p, f), w = Object.hasOwn(l, _) ? l[_] : void 0;
      if (w) {
        if (w !== !0) {
          if (!w.allowCustomPort && g !== "")
            throw new s(S, 400, `Custom ${_} ports not allowed`);
        }
      } else throw new s(S, 400, `Forbidden protocol "${_}"`);
      return S;
    };
  }
  function c() {
    return (l, p) => {
      const f = (0, r.asRequest)(l, p);
      if ((p == null ? void 0 : p.redirect) != null)
        return f;
      if (f.redirect === "follow")
        throw new s(f, 500, 'Request redirect must be "error" or "manual"');
      return f;
    };
  }
  function d() {
    return (l, p) => {
      const { protocol: f, hostname: _ } = (0, n.extractUrl)(l), g = (0, r.asRequest)(l, p);
      if (f !== "http:" && f !== "https:")
        throw new s(g, 400, `"${f}" requests are not allowed`);
      if (!_ || (0, n.isIp)(_))
        throw new s(g, 400, "Invalid hostname");
      return g;
    };
  }
  t.DEFAULT_FORBIDDEN_DOMAIN_NAMES = [
    "example.com",
    "*.example.com",
    "example.org",
    "*.example.org",
    "example.net",
    "*.example.net",
    "googleusercontent.com",
    "*.googleusercontent.com"
  ];
  function u(l = t.DEFAULT_FORBIDDEN_DOMAIN_NAMES) {
    const p = new Set(l);
    return p.size === 0 ? r.asRequest : async (f, _) => {
      const { hostname: g } = (0, n.extractUrl)(f), S = (0, r.asRequest)(f, _);
      if (p.has(g))
        throw new s(S, 403, "Forbidden hostname");
      let w = g.indexOf(".");
      for (; w !== -1; ) {
        const b = g.slice(w + 1);
        if (p.has(`*.${b}`))
          throw new s(S, 403, "Forbidden hostname");
        w = g.indexOf(".", w + 1);
      }
      return S;
    };
  }
})(uc);
var ae = {}, Va = {}, qa = {};
Object.defineProperty(qa, "__esModule", { value: !0 });
qa.pipe = $g;
qa.pipeTwo = kl;
function $g(...t) {
  return t.reduce(kl);
}
function kl(t, e) {
  return async (...r) => e(await t(...r));
}
(function(t) {
  Object.defineProperty(t, "__esModule", { value: !0 }), t.pipeTwo = t.pipe = void 0;
  var e = qa;
  Object.defineProperty(t, "pipe", { enumerable: !0, get: function() {
    return e.pipe;
  } }), Object.defineProperty(t, "pipeTwo", { enumerable: !0, get: function() {
    return e.pipeTwo;
  } });
})(Va);
var Nn = {}, Mg = v && v.__classPrivateFieldSet || function(t, e, r, n, s) {
  if (n === "m") throw new TypeError("Private method is not writable");
  if (n === "a" && !s) throw new TypeError("Private accessor was defined without a setter");
  if (typeof e == "function" ? t !== e || !s : !e.has(t)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return n === "a" ? s.call(t, r) : s ? s.value = r : e.set(t, r), r;
}, Us = v && v.__classPrivateFieldGet || function(t, e, r, n) {
  if (r === "a" && !n) throw new TypeError("Private accessor was defined without a getter");
  if (typeof e == "function" ? t !== e || !n : !e.has(t)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return r === "m" ? n : r === "a" ? n.call(t) : n ? n.value : e.get(t);
}, qt;
Object.defineProperty(Nn, "__esModule", { value: !0 });
Nn.TransformedResponse = void 0;
class Ug extends Response {
  constructor(e, r) {
    if (!e.body)
      throw new TypeError("Response body is not available");
    if (e.bodyUsed)
      throw new TypeError("Response body is already used");
    super(e.body.pipeThrough(r), {
      status: e.status,
      statusText: e.statusText,
      headers: e.headers
    }), qt.set(this, void 0), Mg(this, qt, e, "f");
  }
  /**
   * Some props can't be set through ResponseInit, so we need to proxy them
   */
  get url() {
    return Us(this, qt, "f").url;
  }
  get redirected() {
    return Us(this, qt, "f").redirected;
  }
  get type() {
    return Us(this, qt, "f").type;
  }
  get statusText() {
    return Us(this, qt, "f").statusText;
  }
}
Nn.TransformedResponse = Ug;
qt = /* @__PURE__ */ new WeakMap();
Object.defineProperty(ae, "__esModule", { value: !0 });
ae.fetchJsonZodProcessor = ae.FetchResponseError = void 0;
ae.peekJson = Ng;
ae.checkLength = lc;
ae.extractLength = zl;
ae.extractMime = Ga;
ae.cancelBodyOnError = Wn;
ae.fetchOkProcessor = Wg;
ae.fetchOkTransformer = $l;
ae.fetchMaxSizeProcessor = Hg;
ae.fetchResponseMaxSizeChecker = Ml;
ae.fetchTypeProcessor = Ul;
ae.fetchResponseTypeChecker = Kl;
ae.fetchResponseJsonTransformer = xl;
ae.fetchJsonProcessor = Jg;
ae.fetchJsonValidatorProcessor = Ll;
const Kg = Va, xg = kr, jl = Nn, rr = ve, Dl = /^application\/(?:[^()<>@,;:/[\]\\?={} \t]+\+)?json$/i;
class it extends xg.FetchError {
  constructor(e, r = e.status, n = e.statusText, s) {
    super(r, n, s), Object.defineProperty(this, "response", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: e
    });
  }
  static async from(e, r = Lg, n = e.status, s) {
    const a = typeof r == "string" ? r : typeof r == "function" ? await r(e) : void 0;
    return new it(e, n, a, s);
  }
}
ae.FetchResponseError = it;
const Lg = async (t) => {
  const e = Ga(t);
  if (e)
    try {
      if (e === "text/plain")
        return await t.text();
      if (Dl.test(e)) {
        const r = await t.json();
        if (typeof r == "string")
          return r;
        if (typeof r == "object" && r != null) {
          const n = (0, rr.ifString)(r.error_description);
          if (n)
            return n;
          const s = (0, rr.ifString)(r.error);
          if (s)
            return s;
          const a = (0, rr.ifString)(r.message);
          if (a)
            return a;
        }
      }
    } catch {
    }
};
async function Ng(t, e = 1 / 0) {
  if (Ga(t) !== "application/json")
    return;
  lc(t, e);
  const n = t.clone();
  return (t.body && e < 1 / 0 ? new jl.TransformedResponse(n, new rr.MaxBytesTransformStream(e)) : (
    // Note: some runtimes (e.g. react-native) don't expose a body property
    n
  )).json();
}
function lc(t, e) {
  if (!(e >= 0))
    throw new TypeError("maxBytes must be a non-negative number");
  const r = zl(t);
  if (r != null && r > e)
    throw new it(t, 502, "Response too large");
  return r;
}
function zl(t) {
  const e = t.headers.get("Content-Length");
  if (e == null)
    return;
  if (!/^\d+$/.test(e))
    throw new it(t, 502, "Invalid Content-Length");
  const r = Number(e);
  if (!Number.isSafeInteger(r))
    throw new it(t, 502, "Content-Length too large");
  return r;
}
function Ga(t) {
  const e = t.headers.get("Content-Type");
  if (e != null)
    return e.split(";", 1)[0].trim();
}
function Wn(t, e = rr.logCancellationError) {
  return async (r) => {
    try {
      return await t(r);
    } catch (n) {
      throw await (0, rr.cancelBody)(r, e ?? void 0), n;
    }
  };
}
function Wg(t) {
  return Wn((e) => $l(e, t));
}
async function $l(t, e) {
  if (t.ok)
    return t;
  throw await it.from(t, e);
}
function Hg(t) {
  if (t === 1 / 0)
    return (e) => e;
  if (!Number.isFinite(t) || t < 0)
    throw new TypeError("maxBytes must be a 0, Infinity or a positive number");
  return Wn((e) => Ml(e, t));
}
function Ml(t, e) {
  if (e === 1 / 0 || (lc(t, e), !t.body))
    return t;
  const r = new rr.MaxBytesTransformStream(e);
  return new jl.TransformedResponse(t, r);
}
function Ul(t, e = !0) {
  const r = typeof t == "string" ? (n) => n === t : t instanceof RegExp ? (n) => t.test(n) : t;
  return Wn((n) => Kl(n, r, e));
}
async function Kl(t, e, r = !0) {
  const n = Ga(t);
  if (n) {
    if (!e(n.toLowerCase()))
      throw await it.from(t, `Unexpected response Content-Type (${n})`, 502);
  } else if (r)
    throw await it.from(t, "Missing response Content-Type header", 502);
  return t;
}
async function xl(t) {
  try {
    const e = await t.json();
    return { response: t, json: e };
  } catch (e) {
    throw new it(t, 502, "Unable to parse response as JSON", { cause: e });
  }
}
function Jg(t = Dl, e = !0) {
  return (0, Kg.pipe)(Ul(t, e), Wn(xl));
}
function Ll(t, e) {
  if ("parseAsync" in t && typeof t.parseAsync == "function")
    return async (r) => t.parseAsync(r.json, e);
  if ("parse" in t && typeof t.parse == "function")
    return async (r) => t.parse(r.json, e);
  throw new TypeError("Invalid schema");
}
ae.fetchJsonZodProcessor = Ll;
var Dr = {};
Object.defineProperty(Dr, "__esModule", { value: !0 });
Dr.timedFetch = void 0;
Dr.loggedFetch = Bg;
Dr.bindFetch = qg;
const Zg = uc, hc = jr, Fg = Nn, Ks = ve;
function Bg({ fetch: t = globalThis.fetch, logRequest: e = !0, logResponse: r = !0, logError: n = !0 }) {
  const s = e === !0 ? async (i) => {
    const c = await (0, Ks.stringifyMessage)(i);
    console.info(`> ${i.method} ${i.url}
${(0, Ks.padLines)(c, "  ")}`);
  } : e || void 0, a = r === !0 ? async (i) => {
    const c = await (0, Ks.stringifyMessage)(i.clone());
    console.info(`< HTTP/1.1 ${i.status} ${i.statusText}
${(0, Ks.padLines)(c, "  ")}`);
  } : r || void 0, o = n === !0 ? async (i) => {
    console.error("< Error:", i);
  } : n || void 0;
  return !s && !a && !o ? t : (0, hc.toRequestTransformer)(async function(i) {
    s && await s(i);
    try {
      const c = await t.call(this, i);
      return a && await a(c, i), c;
    } catch (c) {
      throw o && await o(c, i), c;
    }
  });
}
const Vg = (t = 6e4, e = globalThis.fetch) => {
  if (t === 1 / 0)
    return e;
  if (!Number.isFinite(t) || t <= 0)
    throw new TypeError("Timeout must be positive");
  return (0, hc.toRequestTransformer)(async function(r) {
    var d, u;
    const n = new AbortController(), s = n.signal, a = () => {
      n.abort();
    }, o = () => {
      var l;
      clearTimeout(i), (l = r.signal) == null || l.removeEventListener("abort", a);
    }, i = setTimeout(a, t);
    typeof i == "object" && ((d = i.unref) == null || d.call(i)), (u = r.signal) == null || u.addEventListener("abort", a), s.addEventListener("abort", o);
    const c = await e.call(this, r, { signal: s });
    if (c.body) {
      const l = new TransformStream({ flush: o });
      return new Fg.TransformedResponse(c, l);
    } else
      return o(), c;
  });
};
Dr.timedFetch = Vg;
function qg(t = globalThis.fetch, e = globalThis) {
  return (0, hc.toRequestTransformer)(async (r) => {
    try {
      return await t.call(e, r);
    } catch (n) {
      throw Zg.FetchRequestError.from(r, n);
    }
  });
}
(function(t) {
  var e = v && v.__createBinding || (Object.create ? function(n, s, a, o) {
    o === void 0 && (o = a);
    var i = Object.getOwnPropertyDescriptor(s, a);
    (!i || ("get" in i ? !s.__esModule : i.writable || i.configurable)) && (i = { enumerable: !0, get: function() {
      return s[a];
    } }), Object.defineProperty(n, o, i);
  } : function(n, s, a, o) {
    o === void 0 && (o = a), n[o] = s[a];
  }), r = v && v.__exportStar || function(n, s) {
    for (var a in n) a !== "default" && !Object.prototype.hasOwnProperty.call(s, a) && e(s, n, a);
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), r(kr, t), r(uc, t), r(ae, t), r(Dr, t), r(jr, t), r(ve, t);
})(ut);
Object.defineProperty(Ba, "__esModule", { value: !0 });
Ba.DidResolverBase = void 0;
const Gg = R, Zt = Lt, nd = ut;
class Yg {
  constructor(e) {
    Object.defineProperty(this, "methods", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.methods = new Map(Object.entries(e));
  }
  async resolve(e, r) {
    var a;
    (a = r == null ? void 0 : r.signal) == null || a.throwIfAborted();
    const n = (0, Zt.extractDidMethod)(e), s = this.methods.get(n);
    if (!s)
      throw new Zt.DidError(e, "Unsupported DID method", "did-method-invalid", 400);
    try {
      const o = await s.resolve(e, r);
      if (o.id !== e)
        throw new Zt.DidError(e, `DID document id (${o.id}) does not match DID`, "did-document-id-mismatch", 400);
      return o;
    } catch (o) {
      if (o instanceof nd.FetchResponseError) {
        const i = o.response.status >= 500 ? 502 : o.response.status;
        throw new Zt.DidError(e, o.message, "did-fetch-error", i, o);
      }
      throw o instanceof nd.FetchError ? new Zt.DidError(e, o.message, "did-fetch-error", 400, o) : o instanceof Gg.ZodError ? new Zt.DidError(e, o.message, "did-document-format-error", 503, o) : Zt.DidError.from(o, e);
    }
  }
}
Ba.DidResolverBase = Yg;
var Hn = {};
Object.defineProperty(Hn, "__esModule", { value: !0 });
Hn.DidPlcMethod = void 0;
const Nl = Lt, Xs = ut, Xg = Va, Qg = (0, Xg.pipe)((0, Xs.fetchOkProcessor)(), (0, Xs.fetchJsonProcessor)(/^application\/(did\+ld\+)?json$/), (0, Xs.fetchJsonZodProcessor)(Nl.didDocumentValidator));
class ew {
  constructor(e) {
    Object.defineProperty(this, "fetch", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "plcDirectoryUrl", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.plcDirectoryUrl = new URL((e == null ? void 0 : e.plcDirectoryUrl) || "https://plc.directory/"), this.fetch = (0, Xs.bindFetch)(e == null ? void 0 : e.fetch);
  }
  async resolve(e, r) {
    (0, Nl.assertDidPlc)(e);
    const n = new URL(`/${encodeURIComponent(e)}`, this.plcDirectoryUrl);
    return this.fetch(n, {
      redirect: "error",
      headers: { accept: "application/did+ld+json,application/json" },
      signal: r == null ? void 0 : r.signal
    }).then(Qg);
  }
}
Hn.DidPlcMethod = ew;
var zr = {};
Object.defineProperty(zr, "__esModule", { value: !0 });
zr.DidWebMethod = void 0;
zr.buildDidWebDocumentUrl = Wl;
const fc = Lt, Qs = ut, tw = Va, rw = (0, tw.pipe)((0, Qs.fetchOkProcessor)(), (0, Qs.fetchJsonProcessor)(/^application\/(did\+ld\+)?json$/), (0, Qs.fetchJsonZodProcessor)(fc.didDocumentValidator));
class nw {
  constructor({ fetch: e = globalThis.fetch, allowHttp: r = !0 } = {}) {
    Object.defineProperty(this, "fetch", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "allowHttp", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.fetch = (0, Qs.bindFetch)(e), this.allowHttp = r;
  }
  async resolve(e, r) {
    const n = Wl(e);
    if (!this.allowHttp && n.protocol === "http:")
      throw new fc.DidError(e, 'Resolution of "http" did:web is not allowed', "did-web-http-not-allowed");
    return this.fetch(n, {
      redirect: "error",
      headers: { accept: "application/did+ld+json,application/json" },
      signal: r == null ? void 0 : r.signal
    }).then(rw);
  }
}
zr.DidWebMethod = nw;
function Wl(t) {
  const e = (0, fc.didWebToUrl)(t);
  return e.pathname === "/" ? new URL("/.well-known/did.json", e) : new URL(`${e.pathname}/did.json`, e);
}
Object.defineProperty(Fa, "__esModule", { value: !0 });
Fa.DidResolverCommon = void 0;
const sw = Ba, aw = Hn, ow = zr;
class iw extends sw.DidResolverBase {
  constructor(e) {
    super({
      plc: new aw.DidPlcMethod(e),
      web: new ow.DidWebMethod(e)
    });
  }
}
Fa.DidResolverCommon = iw;
var Hl = {};
Object.defineProperty(Hl, "__esModule", { value: !0 });
var Jl = {};
(function(t) {
  var e = v && v.__createBinding || (Object.create ? function(n, s, a, o) {
    o === void 0 && (o = a);
    var i = Object.getOwnPropertyDescriptor(s, a);
    (!i || ("get" in i ? !s.__esModule : i.writable || i.configurable)) && (i = { enumerable: !0, get: function() {
      return s[a];
    } }), Object.defineProperty(n, o, i);
  } : function(n, s, a, o) {
    o === void 0 && (o = a), n[o] = s[a];
  }), r = v && v.__exportStar || function(n, s) {
    for (var a in n) a !== "default" && !Object.prototype.hasOwnProperty.call(s, a) && e(s, n, a);
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), r(Hn, t), r(zr, t);
})(Jl);
(function(t) {
  var e = v && v.__createBinding || (Object.create ? function(n, s, a, o) {
    o === void 0 && (o = a);
    var i = Object.getOwnPropertyDescriptor(s, a);
    (!i || ("get" in i ? !s.__esModule : i.writable || i.configurable)) && (i = { enumerable: !0, get: function() {
      return s[a];
    } }), Object.defineProperty(n, o, i);
  } : function(n, s, a, o) {
    o === void 0 && (o = a), n[o] = s[a];
  }), r = v && v.__exportStar || function(n, s) {
    for (var a in n) a !== "default" && !Object.prototype.hasOwnProperty.call(s, a) && e(s, n, a);
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), r(Lt, t), r(Ln, t), r(Ja, t), r(Cl, t), r(Fa, t), r(Hl, t), r(Jl, t);
})(Kn);
var pc = {}, $r = {};
Object.defineProperty($r, "__esModule", { value: !0 });
$r.HandleResolverError = void 0;
class cw extends Error {
  constructor() {
    super(...arguments), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "HandleResolverError"
    });
  }
}
$r.HandleResolverError = cw;
var or = {};
Object.defineProperty(or, "__esModule", { value: !0 });
or.isResolvedHandle = Zl;
or.asResolvedHandle = uw;
const dw = Lt;
function Zl(t) {
  return t === null || (0, dw.isAtprotoDid)(t);
}
function uw(t) {
  return Zl(t) ? t : null;
}
var Fl = {};
(function(t) {
  Object.defineProperty(t, "__esModule", { value: !0 }), t.XrpcHandleResolver = t.xrpcErrorSchema = void 0;
  const e = R, r = $r, n = or;
  t.xrpcErrorSchema = e.z.object({
    error: e.z.string(),
    message: e.z.string().optional()
  });
  class s {
    constructor(o, i) {
      Object.defineProperty(this, "serviceUrl", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0
      }), Object.defineProperty(this, "fetch", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0
      }), this.serviceUrl = new URL(o), this.fetch = (i == null ? void 0 : i.fetch) ?? globalThis.fetch;
    }
    async resolve(o, i) {
      const c = new URL("/xrpc/com.atproto.identity.resolveHandle", this.serviceUrl);
      c.searchParams.set("handle", o);
      const d = await this.fetch.call(null, c, {
        cache: i != null && i.noCache ? "no-cache" : void 0,
        signal: i == null ? void 0 : i.signal,
        redirect: "error"
      }), u = await d.json();
      if (d.status === 400) {
        const { error: p, data: f } = t.xrpcErrorSchema.safeParse(u);
        if (p)
          throw new r.HandleResolverError(`Invalid response from resolveHandle method: ${p.message}`, { cause: p });
        if (f.error === "InvalidRequest" && f.message === "Unable to resolve handle")
          return null;
      }
      if (!d.ok)
        throw new r.HandleResolverError("Invalid status code from resolveHandle method");
      const l = u == null ? void 0 : u.did;
      if (!(0, n.isResolvedHandle)(l))
        throw new r.HandleResolverError("Invalid DID returned from resolveHandle method");
      return l;
    }
  }
  t.XrpcHandleResolver = s;
})(Fl);
var Ya = {}, Jn = {}, Xa = {};
Object.defineProperty(Xa, "__esModule", { value: !0 });
Xa.DnsHandleResolver = void 0;
const lw = or, hw = "_atproto", Yo = "did=";
class fw {
  constructor(e) {
    Object.defineProperty(this, "resolveTxt", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: e
    });
  }
  async resolve(e) {
    const r = await this.resolveTxt.call(null, `${hw}.${e}`);
    if (!r)
      return null;
    for (let n = 0; n < r.length; n++) {
      if (!r[n].startsWith(Yo))
        continue;
      for (let a = n + 1; a < r.length; a++)
        if (r[a].startsWith(Yo))
          return null;
      const s = r[n].slice(Yo.length);
      return (0, lw.isResolvedHandle)(s) ? s : null;
    }
    return null;
  }
}
Xa.DnsHandleResolver = fw;
var Qa = {};
Object.defineProperty(Qa, "__esModule", { value: !0 });
Qa.WellKnownHandleResolver = void 0;
const pw = or;
class yw {
  constructor(e) {
    Object.defineProperty(this, "fetch", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.fetch = (e == null ? void 0 : e.fetch) ?? globalThis.fetch;
  }
  async resolve(e, r) {
    var s;
    const n = new URL("/.well-known/atproto-did", `https://${e}`);
    try {
      const i = (await (await this.fetch.call(null, n, {
        cache: r != null && r.noCache ? "no-cache" : void 0,
        signal: r == null ? void 0 : r.signal,
        redirect: "error"
      })).text()).split(`
`)[0].trim();
      return (0, pw.isResolvedHandle)(i) ? i : null;
    } catch {
      return (s = r == null ? void 0 : r.signal) == null || s.throwIfAborted(), null;
    }
  }
}
Qa.WellKnownHandleResolver = yw;
Object.defineProperty(Jn, "__esModule", { value: !0 });
Jn.AtprotoHandleResolver = void 0;
const sd = Xa, mw = Qa, _w = () => {
};
class gw {
  constructor(e) {
    Object.defineProperty(this, "httpResolver", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "dnsResolver", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "dnsResolverFallback", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.httpResolver = new mw.WellKnownHandleResolver(e), this.dnsResolver = new sd.DnsHandleResolver(e.resolveTxt), this.dnsResolverFallback = e.resolveTxtFallback ? new sd.DnsHandleResolver(e.resolveTxtFallback) : void 0;
  }
  async resolve(e, r) {
    var o, i, c;
    (o = r == null ? void 0 : r.signal) == null || o.throwIfAborted();
    const n = new AbortController(), { signal: s } = n;
    (i = r == null ? void 0 : r.signal) == null || i.addEventListener("abort", () => n.abort(), {
      signal: s
    });
    const a = { ...r, signal: s };
    try {
      const d = this.dnsResolver.resolve(e, a), u = this.httpResolver.resolve(e, a);
      u.catch(_w);
      const l = await d;
      if (l)
        return l;
      s.throwIfAborted();
      const p = await u;
      return p || (s.throwIfAborted(), ((c = this.dnsResolverFallback) == null ? void 0 : c.resolve(e, a)) ?? null);
    } finally {
      n.abort();
    }
  }
}
Jn.AtprotoHandleResolver = gw;
Object.defineProperty(Ya, "__esModule", { value: !0 });
Ya.AtprotoDohHandleResolver = void 0;
const ww = Jn, ji = $r;
class vw extends ww.AtprotoHandleResolver {
  constructor(e) {
    super({
      ...e,
      resolveTxt: bw(e),
      resolveTxtFallback: void 0
    });
  }
}
Ya.AtprotoDohHandleResolver = vw;
function bw({ dohEndpoint: t, fetch: e = globalThis.fetch }) {
  return async (r) => {
    var a, o, i;
    const n = new URL(t);
    n.searchParams.set("type", "TXT"), n.searchParams.set("name", r);
    const s = await e(n, {
      method: "GET",
      headers: { accept: "application/dns-json" },
      redirect: "follow"
    });
    try {
      const c = (a = s.headers.get("content-type")) == null ? void 0 : a.trim();
      if (s.ok) {
        if ((c == null ? void 0 : c.match(/application\/(dns-)?json/i)) == null)
          throw new ji.HandleResolverError("Unexpected response from DoH server");
      } else {
        const u = c != null && c.startsWith("text/plain") ? await s.text() : `Failed to resolve ${r}`;
        throw new ji.HandleResolverError(u);
      }
      return ((o = Aw(await s.json()).Answer) == null ? void 0 : o.filter(Cw).map(Ow)) ?? null;
    } finally {
      s.bodyUsed === !1 && ((i = s.body) == null || i.cancel().catch(Sw));
    }
  };
}
function Sw(t) {
  (!(t instanceof DOMException) || t.name !== "AbortError") && console.error("An error occurred while cancelling the response body:", t);
}
function Ew(t) {
  return !(typeof t != "object" || t === null || !("Status" in t) || typeof t.Status != "number" || "Answer" in t && !Pw(t.Answer, Iw));
}
function Aw(t) {
  if (Ew(t))
    return t;
  throw new ji.HandleResolverError("Invalid DoH response");
}
function Pw(t, e) {
  return Array.isArray(t) && t.every(e);
}
function Iw(t) {
  return typeof t == "object" && t !== null && "name" in t && typeof t.name == "string" && "type" in t && typeof t.type == "number" && "data" in t && typeof t.data == "string" && "TTL" in t && typeof t.TTL == "number";
}
function Cw(t) {
  return t.type === 16;
}
function Ow(t) {
  return t.data.replace(/^"|"$/g, "").replace(/\\"/g, '"');
}
var eo = {};
Object.defineProperty(eo, "__esModule", { value: !0 });
eo.CachedHandleResolver = void 0;
const Tw = Rr, Rw = Tr;
class kw {
  constructor(e, r = new Rw.SimpleStoreMemory({
    max: 1e3,
    ttl: 10 * 6e4
  })) {
    Object.defineProperty(this, "getter", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.getter = new Tw.CachedGetter((n, s) => e.resolve(n, s), r);
  }
  async resolve(e, r) {
    return this.getter.get(e, r);
  }
}
eo.CachedHandleResolver = kw;
(function(t) {
  var e = v && v.__createBinding || (Object.create ? function(n, s, a, o) {
    o === void 0 && (o = a);
    var i = Object.getOwnPropertyDescriptor(s, a);
    (!i || ("get" in i ? !s.__esModule : i.writable || i.configurable)) && (i = { enumerable: !0, get: function() {
      return s[a];
    } }), Object.defineProperty(n, o, i);
  } : function(n, s, a, o) {
    o === void 0 && (o = a), n[o] = s[a];
  }), r = v && v.__exportStar || function(n, s) {
    for (var a in n) a !== "default" && !Object.prototype.hasOwnProperty.call(s, a) && e(s, n, a);
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), r($r, t), r(or, t), r(Fl, t), r(Ya, t), r(Jn, t), r(eo, t);
})(pc);
var xe = {}, Zn = {};
Object.defineProperty(Zn, "__esModule", { value: !0 });
Zn.CLIENT_ASSERTION_TYPE_JWT_BEARER = void 0;
Zn.CLIENT_ASSERTION_TYPE_JWT_BEARER = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
var gt = {}, G = {};
Object.defineProperty(G, "__esModule", { value: !0 });
G.isSpaceSeparatedValue = G.numberPreprocess = G.jsonObjectPreprocess = G.canParseUrl = void 0;
G.isHostnameIP = jw;
G.isLoopbackHost = Dw;
G.isLocalHostname = zw;
G.safeUrl = $w;
G.extractUrlPath = Mw;
G.arrayEquivalent = xw;
G.includedIn = Di;
G.asArray = Lw;
var $d;
G.canParseUrl = // eslint-disable-next-line n/no-unsupported-features/node-builtins
(($d = URL.canParse) == null ? void 0 : $d.bind(URL)) ?? // URL.canParse is not available in Node.js < 18.7.0
((t) => {
  try {
    return new URL(t), !0;
  } catch {
    return !1;
  }
});
function jw(t) {
  return !!(t.match(/^\d+\.\d+\.\d+\.\d+$/) || t.startsWith("[") && t.endsWith("]"));
}
function Dw(t) {
  return t === "localhost" || t === "127.0.0.1" || t === "[::1]";
}
function zw(t) {
  const e = t.split(".");
  if (e.length < 2)
    return !0;
  const r = e.at(-1).toLowerCase();
  return r === "test" || r === "local" || r === "localhost" || r === "invalid" || r === "example";
}
function $w(t) {
  try {
    return new URL(t);
  } catch {
    return null;
  }
}
function Mw(t) {
  const e = t.startsWith("https://") ? 8 : t.startsWith("http://") ? 7 : -1;
  if (e === -1)
    throw new TypeError('URL must use the "https:" or "http:" protocol');
  const r = t.indexOf("#", e), n = t.indexOf("?", e), s = n !== -1 && (r === -1 || n < r) ? n : -1, a = r === -1 ? s === -1 ? t.length : s : s === -1 ? r : Math.min(r, s), o = t.indexOf("/", e), i = o === -1 || o > a ? a : o;
  if (e === i)
    throw new TypeError("URL must contain a host");
  return t.substring(i, a);
}
const Uw = (t) => {
  if (typeof t == "string" && t.startsWith("{") && t.endsWith("}"))
    try {
      return JSON.parse(t);
    } catch {
      return t;
    }
  return t;
};
G.jsonObjectPreprocess = Uw;
const Kw = (t) => {
  if (typeof t == "string") {
    const e = Number(t);
    if (!Number.isNaN(e))
      return e;
  }
  return t;
};
G.numberPreprocess = Kw;
function xw(t, e) {
  return t === e ? !0 : t.every(Di, e) && e.every(Di, t);
}
function Di(t) {
  return this.includes(t);
}
function Lw(t) {
  if (t != null)
    return Array.isArray(t) ? t : Array.from(t);
}
const Nw = (t, e) => {
  if (t.length === 0)
    throw new TypeError("Value cannot be empty");
  if (t.includes(" "))
    throw new TypeError("Value cannot contain spaces");
  const r = e.length, n = t.length;
  if (r < n)
    return !1;
  let s = e.indexOf(t), a;
  for (; s !== -1; ) {
    if (a = s + n, // at beginning or preceded by space
    (s === 0 || e.charCodeAt(s - 1) === 32) && // at end or followed by space
    (a === r || e.charCodeAt(a) === 32))
      return !0;
    s = e.indexOf(t, a + 1);
  }
  return !1;
};
G.isSpaceSeparatedValue = Nw;
(function(t) {
  Object.defineProperty(t, "__esModule", { value: !0 }), t.privateUseUriSchema = t.webUriSchema = t.httpsUriSchema = t.loopbackUriSchema = t.dangerousUriSchema = void 0;
  const e = R, r = G;
  t.dangerousUriSchema = e.z.string().refine((n) => n.includes(":") && (0, r.canParseUrl)(n), {
    message: "Invalid URL"
  }), t.loopbackUriSchema = t.dangerousUriSchema.superRefine((n, s) => {
    if (!n.startsWith("http://"))
      return s.addIssue({
        code: e.ZodIssueCode.custom,
        message: 'URL must use the "http:" protocol'
      }), !1;
    const a = new URL(n);
    return (0, r.isLoopbackHost)(a.hostname) ? !0 : (s.addIssue({
      code: e.ZodIssueCode.custom,
      message: 'URL must use "localhost", "127.0.0.1" or "[::1]" as hostname'
    }), !1);
  }), t.httpsUriSchema = t.dangerousUriSchema.superRefine((n, s) => {
    if (!n.startsWith("https://"))
      return s.addIssue({
        code: e.ZodIssueCode.custom,
        message: 'URL must use the "https:" protocol'
      }), !1;
    const a = new URL(n);
    if ((0, r.isLoopbackHost)(a.hostname))
      return s.addIssue({
        code: e.ZodIssueCode.custom,
        message: "https: URL must not use a loopback host"
      }), !1;
    if (!(0, r.isHostnameIP)(a.hostname)) {
      if (!a.hostname.includes("."))
        return s.addIssue({
          code: e.ZodIssueCode.custom,
          message: "Domain name must contain at least two segments"
        }), !1;
      if (a.hostname.endsWith(".local"))
        return s.addIssue({
          code: e.ZodIssueCode.custom,
          message: 'Domain name must not end with ".local"'
        }), !1;
    }
    return !0;
  }), t.webUriSchema = e.z.string().superRefine((n, s) => {
    if (n.startsWith("http://")) {
      const a = t.loopbackUriSchema.safeParse(n);
      return a.success || a.error.issues.forEach(s.addIssue, s), a.success;
    }
    if (n.startsWith("https://")) {
      const a = t.httpsUriSchema.safeParse(n);
      return a.success || a.error.issues.forEach(s.addIssue, s), a.success;
    }
    return s.addIssue({
      code: e.ZodIssueCode.custom,
      message: 'URL must use the "http:" or "https:" protocol'
    }), !1;
  }), t.privateUseUriSchema = t.dangerousUriSchema.superRefine((n, s) => {
    const a = n.indexOf("."), o = n.indexOf(":");
    if (a === -1 || o === -1 || a > o)
      return s.addIssue({
        code: e.ZodIssueCode.custom,
        message: 'Private-use URI scheme requires a "." as part of the protocol'
      }), !1;
    const i = new URL(n);
    if (!i.protocol.includes("."))
      return s.addIssue({
        code: e.ZodIssueCode.custom,
        message: "Invalid private-use URI scheme"
      }), !1;
    const d = i.protocol.slice(0, -1).split(".").reverse().join(".");
    return (0, r.isLocalHostname)(d) && s.addIssue({
      code: e.ZodIssueCode.custom,
      message: "Private-use URI Scheme redirect URI must not be a local hostname"
    }), i.href.startsWith(`${i.protocol}//`) || i.username || i.password || i.hostname || i.port ? (s.addIssue({
      code: e.ZodIssueCode.custom,
      message: `Private-Use URI Scheme must be in the form ${i.protocol}/<path> (as per RFC 8252)`
    }), !1) : !0;
  });
})(gt);
var Fn = {}, Bn = {};
Object.defineProperty(Bn, "__esModule", { value: !0 });
Bn.DEFAULT_LOOPBACK_CLIENT_REDIRECT_URIS = void 0;
Bn.DEFAULT_LOOPBACK_CLIENT_REDIRECT_URIS = Object.freeze([
  "http://127.0.0.1/",
  "http://[::1]/"
]);
var to = {}, Mr = {};
(function(t) {
  Object.defineProperty(t, "__esModule", { value: !0 }), t.oauthScopeSchema = t.isOAuthScope = t.OAUTH_SCOPE_REGEXP = void 0;
  const e = R;
  t.OAUTH_SCOPE_REGEXP = /^[\x21\x23-\x5B\x5D-\x7E]+(?: [\x21\x23-\x5B\x5D-\x7E]+)*$/;
  const r = (n) => t.OAUTH_SCOPE_REGEXP.test(n);
  t.isOAuthScope = r, t.oauthScopeSchema = e.z.string().refine(t.isOAuthScope, {
    message: "Invalid OAuth scope"
  });
})(Mr);
(function(t) {
  Object.defineProperty(t, "__esModule", { value: !0 }), t.DEFAULT_ATPROTO_OAUTH_SCOPE = t.atprotoOAuthScopeSchema = t.ATPROTO_SCOPE_VALUE = void 0, t.isAtprotoOAuthScope = s, t.asAtprotoOAuthScope = a, t.assertAtprotoOAuthScope = o;
  const e = R, r = Mr, n = G;
  t.ATPROTO_SCOPE_VALUE = "atproto";
  function s(i) {
    return (0, r.isOAuthScope)(i) && (0, n.isSpaceSeparatedValue)(t.ATPROTO_SCOPE_VALUE, i);
  }
  function a(i) {
    if (s(i))
      return i;
    throw new TypeError(`Value must contain "${t.ATPROTO_SCOPE_VALUE}" scope value`);
  }
  function o(i) {
    a(i);
  }
  t.atprotoOAuthScopeSchema = e.z.string().refine(s, {
    message: "Invalid ATProto OAuth scope"
  }), t.DEFAULT_ATPROTO_OAUTH_SCOPE = t.ATPROTO_SCOPE_VALUE;
})(to);
var yc = {}, wt = {};
Object.defineProperty(wt, "__esModule", { value: !0 });
wt.oauthClientIdSchema = void 0;
const Ww = R;
wt.oauthClientIdSchema = Ww.z.string().min(1);
var ir = {};
(function(t) {
  Object.defineProperty(t, "__esModule", { value: !0 }), t.oauthRedirectUriSchema = t.oauthLoopbackClientRedirectUriSchema = t.loopbackRedirectURISchema = void 0;
  const e = R, r = gt;
  t.loopbackRedirectURISchema = r.loopbackUriSchema.superRefine((n, s) => n.startsWith("http://localhost") ? (s.addIssue({
    code: e.ZodIssueCode.custom,
    message: 'Use of "localhost" hostname is not allowed (RFC 8252), use a loopback IP such as "127.0.0.1" instead'
  }), !1) : !0), t.oauthLoopbackClientRedirectUriSchema = t.loopbackRedirectURISchema, t.oauthRedirectUriSchema = e.z.union([t.loopbackRedirectURISchema, r.httpsUriSchema, r.privateUseUriSchema], {
    message: 'URL must use the "https:" or "http:" protocol, or a private-use URI scheme (RFC 8252)'
  });
})(ir);
(function(t) {
  Object.defineProperty(t, "__esModule", { value: !0 }), t.oauthClientIdLoopbackSchema = t.LOOPBACK_CLIENT_ID_ORIGIN = void 0, t.assertOAuthLoopbackClientId = s, t.isOAuthClientIdLoopback = a, t.asOAuthClientIdLoopback = o, t.parseOAuthLoopbackClientId = i, t.safeParseOAuthLoopbackClientId = c, t.safeParseOAuthLoopbackClientIdQueryString = d;
  const e = wt, r = ir, n = Mr;
  t.LOOPBACK_CLIENT_ID_ORIGIN = "http://localhost", t.oauthClientIdLoopbackSchema = e.oauthClientIdSchema.superRefine((u, l) => {
    const p = c(u);
    return p.success || l.addIssue({ code: "custom", message: p.message }), p.success;
  });
  function s(u) {
    i(u);
  }
  function a(u) {
    return c(u).success;
  }
  function o(u) {
    return s(u), u;
  }
  function i(u) {
    const l = c(u);
    if (l.success)
      return l.value;
    throw new TypeError(`Invalid loopback client ID: ${l.message}`);
  }
  function c(u) {
    if (!u.startsWith(t.LOOPBACK_CLIENT_ID_ORIGIN))
      return {
        success: !1,
        message: `Value must start with "${t.LOOPBACK_CLIENT_ID_ORIGIN}"`
      };
    if (u.includes("#", t.LOOPBACK_CLIENT_ID_ORIGIN.length))
      return {
        success: !1,
        message: "Value must not contain a hash component"
      };
    const l = u.length > t.LOOPBACK_CLIENT_ID_ORIGIN.length && u.charCodeAt(t.LOOPBACK_CLIENT_ID_ORIGIN.length) === 47 ? t.LOOPBACK_CLIENT_ID_ORIGIN.length + 1 : t.LOOPBACK_CLIENT_ID_ORIGIN.length;
    if (u.length !== l && u.charCodeAt(l) !== 63)
      return {
        success: !1,
        message: "Value must not contain a path component"
      };
    const p = u.slice(l + 1);
    return d(p);
  }
  function d(u) {
    const l = {}, p = typeof u == "string" ? new URLSearchParams(u) : u;
    for (const [f, _] of p)
      if (f === "scope") {
        if ("scope" in l)
          return {
            success: !1,
            message: 'Duplicate "scope" query parameter'
          };
        const g = n.oauthScopeSchema.safeParse(_);
        if (!g.success)
          return {
            success: !1,
            message: `Invalid "scope" query parameter: ${g.error.issues.map((w) => w.message).join(", ") || "Validation failed"}`
          };
        l.scope = g.data;
      } else if (f === "redirect_uri") {
        const g = r.oauthLoopbackClientRedirectUriSchema.safeParse(_);
        if (!g.success)
          return {
            success: !1,
            message: `Invalid "redirect_uri" query parameter: ${g.error.issues.map((w) => w.message).join(", ") || "Validation failed"}`
          };
        l.redirect_uris == null ? l.redirect_uris = [g.data] : l.redirect_uris.push(g.data);
      } else
        return {
          success: !1,
          message: `Unexpected query parameter "${f}"`
        };
    return {
      success: !0,
      value: l
    };
  }
})(yc);
Object.defineProperty(Fn, "__esModule", { value: !0 });
Fn.buildAtprotoLoopbackClientId = Jw;
Fn.parseAtprotoLoopbackClientId = Zw;
const Bl = Bn, _a = to, zi = yc, Hw = ir, ad = G;
function Jw(t) {
  if (t) {
    const e = new URLSearchParams(), { scope: r } = t;
    r != null && r !== _a.DEFAULT_ATPROTO_OAUTH_SCOPE && e.set("scope", (0, _a.asAtprotoOAuthScope)(r));
    const n = (0, ad.asArray)(t.redirect_uris);
    if (n && !(0, ad.arrayEquivalent)(n, Bl.DEFAULT_LOOPBACK_CLIENT_REDIRECT_URIS)) {
      if (!n.length)
        throw new TypeError('Unexpected empty "redirect_uris" config');
      for (const s of n)
        e.append("redirect_uri", Hw.oauthLoopbackClientRedirectUriSchema.parse(s));
    }
    if (e.size)
      return `${zi.LOOPBACK_CLIENT_ID_ORIGIN}?${e.toString()}`;
  }
  return zi.LOOPBACK_CLIENT_ID_ORIGIN;
}
function Zw(t) {
  const { scope: e = _a.DEFAULT_ATPROTO_OAUTH_SCOPE, redirect_uris: r } = (0, zi.parseOAuthLoopbackClientId)(t);
  if (!(0, _a.isAtprotoOAuthScope)(e))
    throw new TypeError('ATProto Loopback ClientID must include "atproto" scope');
  return {
    scope: e,
    redirect_uris: r ?? [...Bl.DEFAULT_LOOPBACK_CLIENT_REDIRECT_URIS]
  };
}
var ro = {};
Object.defineProperty(ro, "__esModule", { value: !0 });
ro.atprotoLoopbackClientMetadata = Fw;
ro.buildAtprotoLoopbackClientMetadata = Bw;
const $i = Fn;
function Fw(t) {
  const e = (0, $i.parseAtprotoLoopbackClientId)(t);
  return Vl(t, e);
}
function Bw(t) {
  const e = (0, $i.buildAtprotoLoopbackClientId)(t);
  return Vl(e, (0, $i.parseAtprotoLoopbackClientId)(e));
}
function Vl(t, e) {
  return {
    client_id: t,
    scope: e.scope,
    redirect_uris: e.redirect_uris,
    response_types: ["code"],
    grant_types: ["authorization_code", "refresh_token"],
    token_endpoint_auth_method: "none",
    application_type: "native",
    dpop_bound_access_tokens: !0
  };
}
var no = {}, Vn = {}, so = {};
(function(t) {
  Object.defineProperty(t, "__esModule", { value: !0 }), t.oauthAuthorizationDetailsSchema = t.oauthAuthorizationDetailSchema = void 0;
  const e = R, r = gt;
  t.oauthAuthorizationDetailSchema = e.z.object({
    type: e.z.string(),
    /**
     * An array of strings representing the location of the resource or RS. These
     * strings are typically URIs identifying the location of the RS.
     */
    locations: e.z.array(r.dangerousUriSchema).optional(),
    /**
     * An array of strings representing the kinds of actions to be taken at the
     * resource.
     */
    actions: e.z.array(e.z.string()).optional(),
    /**
     * An array of strings representing the kinds of data being requested from the
     * resource.
     */
    datatypes: e.z.array(e.z.string()).optional(),
    /**
     * A string identifier indicating a specific resource available at the API.
     */
    identifier: e.z.string().optional(),
    /**
     * An array of strings representing the types or levels of privilege being
     * requested at the resource.
     */
    privileges: e.z.array(e.z.string()).optional()
  }), t.oauthAuthorizationDetailsSchema = e.z.array(t.oauthAuthorizationDetailSchema);
})(so);
var qn = {};
Object.defineProperty(qn, "__esModule", { value: !0 });
qn.oauthTokenTypeSchema = void 0;
const Xo = R;
qn.oauthTokenTypeSchema = Xo.z.union([
  Xo.z.string().regex(/^DPoP$/i).transform(() => "DPoP"),
  Xo.z.string().regex(/^Bearer$/i).transform(() => "Bearer")
]);
Object.defineProperty(Vn, "__esModule", { value: !0 });
Vn.oauthTokenResponseSchema = void 0;
const Xr = R, Vw = ct, qw = so, Gw = qn;
Vn.oauthTokenResponseSchema = Xr.z.object({
  // https://www.rfc-editor.org/rfc/rfc6749.html#section-5.1
  access_token: Xr.z.string(),
  token_type: Gw.oauthTokenTypeSchema,
  scope: Xr.z.string().optional(),
  refresh_token: Xr.z.string().optional(),
  expires_in: Xr.z.number().optional(),
  // https://openid.net/specs/openid-connect-core-1_0.html#TokenResponse
  id_token: Vw.signedJwtSchema.optional(),
  // https://datatracker.ietf.org/doc/html/rfc9396#name-enriched-authorization-deta
  authorization_details: qw.oauthAuthorizationDetailsSchema.optional()
}).passthrough();
Object.defineProperty(no, "__esModule", { value: !0 });
no.atprotoOAuthTokenResponseSchema = void 0;
const od = R, Yw = Lt, Xw = to, Qw = Vn;
no.atprotoOAuthTokenResponseSchema = Qw.oauthTokenResponseSchema.extend({
  token_type: od.z.literal("DPoP"),
  sub: Yw.atprotoDidSchema,
  scope: Xw.atprotoOAuthScopeSchema,
  // OpenID is not compatible with atproto identities
  id_token: od.z.never().optional()
});
var Gn = {};
Object.defineProperty(Gn, "__esModule", { value: !0 });
Gn.oauthAccessTokenSchema = void 0;
const ev = R;
Gn.oauthAccessTokenSchema = ev.z.string().min(1);
var Yn = {};
Object.defineProperty(Yn, "__esModule", { value: !0 });
Yn.oauthAuthorizationCodeGrantTokenRequestSchema = void 0;
const xs = R, tv = ir;
Yn.oauthAuthorizationCodeGrantTokenRequestSchema = xs.z.object({
  grant_type: xs.z.literal("authorization_code"),
  code: xs.z.string().min(1),
  redirect_uri: tv.oauthRedirectUriSchema,
  /** @see {@link https://datatracker.ietf.org/doc/html/rfc7636#section-4.1} */
  code_verifier: xs.z.string().min(43).max(128).regex(/^[a-zA-Z0-9-._~]+$/).optional()
});
var Ur = {};
Object.defineProperty(Ur, "__esModule", { value: !0 });
Ur.oauthAuthorizationRequestJarSchema = void 0;
const id = R, cd = ct;
Ur.oauthAuthorizationRequestJarSchema = id.z.object({
  /**
   * AuthorizationRequest inside a JWT:
   * - "iat" is required and **MUST** be less than one minute
   *
   * @see {@link https://datatracker.ietf.org/doc/html/rfc9101}
   */
  request: id.z.union([cd.signedJwtSchema, cd.unsignedJwtSchema])
});
var ao = {}, Kr = {}, Xn = {};
Object.defineProperty(Xn, "__esModule", { value: !0 });
Xn.oauthCodeChallengeMethodSchema = void 0;
const rv = R;
Xn.oauthCodeChallengeMethodSchema = rv.z.enum(["S256", "plain"]);
var Qn = {};
Object.defineProperty(Qn, "__esModule", { value: !0 });
Qn.oauthResponseModeSchema = void 0;
const nv = R;
Qn.oauthResponseModeSchema = nv.z.enum([
  "query",
  "fragment",
  "form_post"
]);
var xr = {};
Object.defineProperty(xr, "__esModule", { value: !0 });
xr.oauthResponseTypeSchema = void 0;
const sv = R;
xr.oauthResponseTypeSchema = sv.z.enum([
  // OAuth2 (https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-10#section-4.1.1)
  "code",
  // Authorization Code Grant
  "token",
  // Implicit Grant
  // OIDC (https://openid.net/specs/oauth-v2-multiple-response-types-1_0.html)
  "none",
  "code id_token token",
  "code id_token",
  "code token",
  "id_token token",
  "id_token"
]);
var es = {};
Object.defineProperty(es, "__esModule", { value: !0 });
es.oidcClaimsParameterSchema = void 0;
const av = R;
es.oidcClaimsParameterSchema = av.z.enum([
  // https://openid.net/specs/openid-provider-authentication-policy-extension-1_0.html#rfc.section.5.2
  // if client metadata "require_auth_time" is true, this *must* be provided
  "auth_time",
  // OIDC
  "nonce",
  "acr",
  // OpenID: "profile" scope
  "name",
  "family_name",
  "given_name",
  "middle_name",
  "nickname",
  "preferred_username",
  "gender",
  "picture",
  "profile",
  "website",
  "birthdate",
  "zoneinfo",
  "locale",
  "updated_at",
  // OpenID: "email" scope
  "email",
  "email_verified",
  // OpenID: "phone" scope
  "phone_number",
  "phone_number_verified",
  // OpenID: "address" scope
  "address"
]);
var ts = {};
Object.defineProperty(ts, "__esModule", { value: !0 });
ts.oidcClaimsPropertiesSchema = void 0;
const Xt = R, dd = Xt.z.union([Xt.z.string(), Xt.z.number(), Xt.z.boolean()]);
ts.oidcClaimsPropertiesSchema = Xt.z.object({
  essential: Xt.z.boolean().optional(),
  value: dd.optional(),
  values: Xt.z.array(dd).optional()
});
var rs = {};
Object.defineProperty(rs, "__esModule", { value: !0 });
rs.oidcEntityTypeSchema = void 0;
const ov = R;
rs.oidcEntityTypeSchema = ov.z.enum(["userinfo", "id_token"]);
Object.defineProperty(Kr, "__esModule", { value: !0 });
Kr.oauthAuthorizationRequestParametersSchema = void 0;
const ye = R, iv = ct, cv = so, dv = wt, uv = Xn, lv = ir, hv = Qn, fv = xr, pv = Mr, yv = es, mv = ts, _v = rs, Qo = G;
Kr.oauthAuthorizationRequestParametersSchema = ye.z.object({
  client_id: dv.oauthClientIdSchema,
  state: ye.z.string().optional(),
  redirect_uri: lv.oauthRedirectUriSchema.optional(),
  scope: pv.oauthScopeSchema.optional(),
  response_type: fv.oauthResponseTypeSchema,
  // PKCE
  // https://datatracker.ietf.org/doc/html/rfc7636#section-4.3
  code_challenge: ye.z.string().optional(),
  code_challenge_method: uv.oauthCodeChallengeMethodSchema.optional(),
  // DPOP
  // https://datatracker.ietf.org/doc/html/rfc9449#section-12.3
  dpop_jkt: ye.z.string().optional(),
  // OIDC
  // Default depend on response_type
  response_mode: hv.oauthResponseModeSchema.optional(),
  nonce: ye.z.string().optional(),
  // Specifies the allowable elapsed time in seconds since the last time the
  // End-User was actively authenticated by the OP. If the elapsed time is
  // greater than this value, the OP MUST attempt to actively re-authenticate
  // the End-User. (The max_age request parameter corresponds to the OpenID 2.0
  // PAPE [OpenID.PAPE] max_auth_age request parameter.) When max_age is used,
  // the ID Token returned MUST include an auth_time Claim Value. Note that
  // max_age=0 is equivalent to prompt=login.
  max_age: ye.z.preprocess(Qo.numberPreprocess, ye.z.number().int().min(0)).optional(),
  claims: ye.z.preprocess(Qo.jsonObjectPreprocess, ye.z.record(_v.oidcEntityTypeSchema, ye.z.record(yv.oidcClaimsParameterSchema, ye.z.union([ye.z.literal(null), mv.oidcClaimsPropertiesSchema])))).optional(),
  // https://openid.net/specs/openid-connect-core-1_0.html#RegistrationParameter
  // Not supported by this library (yet?)
  // registration: clientMetadataSchema.optional(),
  login_hint: ye.z.string().min(1).optional(),
  ui_locales: ye.z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?( [a-z]{2,3}(-[A-Z]{2})?)*$/).optional(),
  // Previous ID Token, should be provided when prompt=none is used
  id_token_hint: iv.signedJwtSchema.optional(),
  // Type of UI the AS is displayed on
  display: ye.z.enum(["page", "popup", "touch", "wap"]).optional(),
  /**
   * - "none" will only be allowed if the user already allowed the client on the same device
   * - "login" will force the user to login again, unless he very recently logged in
   * - "consent" will force the user to consent again
   * - "select_account" will force the user to select an account
   */
  prompt: ye.z.enum(["none", "login", "consent", "select_account"]).optional(),
  // https://datatracker.ietf.org/doc/html/rfc9396
  authorization_details: ye.z.preprocess(Qo.jsonObjectPreprocess, cv.oauthAuthorizationDetailsSchema).optional()
});
Object.defineProperty(ao, "__esModule", { value: !0 });
ao.oauthAuthorizationRequestParSchema = void 0;
const gv = R, wv = Ur, vv = Kr;
ao.oauthAuthorizationRequestParSchema = gv.z.union([
  vv.oauthAuthorizationRequestParametersSchema,
  wv.oauthAuthorizationRequestJarSchema
]);
var oo = {}, ns = {}, ss = {};
Object.defineProperty(ss, "__esModule", { value: !0 });
ss.oauthRequestUriSchema = void 0;
const bv = R;
ss.oauthRequestUriSchema = bv.z.string();
Object.defineProperty(ns, "__esModule", { value: !0 });
ns.oauthAuthorizationRequestUriSchema = void 0;
const Sv = R, Ev = ss;
ns.oauthAuthorizationRequestUriSchema = Sv.z.object({
  request_uri: Ev.oauthRequestUriSchema
});
Object.defineProperty(oo, "__esModule", { value: !0 });
oo.oauthAuthorizationRequestQuerySchema = void 0;
const Av = R, Pv = Ur, Iv = Kr, Cv = ns;
oo.oauthAuthorizationRequestQuerySchema = Av.z.union([
  Iv.oauthAuthorizationRequestParametersSchema,
  Pv.oauthAuthorizationRequestJarSchema,
  Cv.oauthAuthorizationRequestUriSchema
]);
var io = {};
Object.defineProperty(io, "__esModule", { value: !0 });
io.oauthAuthorizationResponseErrorSchema = void 0;
const Ov = R;
io.oauthAuthorizationResponseErrorSchema = Ov.z.enum([
  // The request is missing a required parameter, includes an invalid parameter value, includes a parameter more than once, or is otherwise malformed.
  "invalid_request",
  // The client is not authorized to request an authorization code using this method.
  "unauthorized_client",
  // The resource owner or authorization server denied the request.
  "access_denied",
  // The authorization server does not support obtaining an authorization code using this method.
  "unsupported_response_type",
  // The requested scope is invalid, unknown, or malformed.
  "invalid_scope",
  // The authorization server encountered an unexpected condition that prevented it from fulfilling the request. (This error code is needed because a 500 Internal Server Error HTTP status code cannot be returned to the client via an HTTP redirect.)
  "server_error",
  // The authorization server is currently unable to handle the request due to a temporary overloading or maintenance of the server. (This error code is needed because a 503 Service Unavailable HTTP status code cannot be returned to the client via an HTTP redirect.)
  "temporarily_unavailable"
]);
var ql = {}, Lr = {};
Object.defineProperty(Lr, "__esModule", { value: !0 });
Lr.oauthIssuerIdentifierSchema = void 0;
const Ls = R, Tv = gt;
Lr.oauthIssuerIdentifierSchema = Tv.webUriSchema.superRefine((t, e) => {
  if (t.endsWith("/"))
    return e.addIssue({
      code: Ls.z.ZodIssueCode.custom,
      message: "Issuer URL must not end with a slash"
    }), !1;
  const r = new URL(t);
  if (r.username || r.password)
    return e.addIssue({
      code: Ls.z.ZodIssueCode.custom,
      message: "Issuer URL must not contain a username or password"
    }), !1;
  if (r.hash || r.search)
    return e.addIssue({
      code: Ls.z.ZodIssueCode.custom,
      message: "Issuer URL must not contain a query or fragment"
    }), !1;
  const n = r.pathname === "/" ? r.origin : r.href;
  return t !== n ? (e.addIssue({
    code: Ls.z.ZodIssueCode.custom,
    message: "Issuer URL must be in the canonical form"
  }), !1) : !0;
});
(function(t) {
  Object.defineProperty(t, "__esModule", { value: !0 }), t.oauthAuthorizationServerMetadataValidator = t.oauthAuthorizationServerMetadataSchema = void 0;
  const e = R, r = Xn, n = Lr, s = gt;
  t.oauthAuthorizationServerMetadataSchema = e.z.object({
    issuer: n.oauthIssuerIdentifierSchema,
    claims_supported: e.z.array(e.z.string()).optional(),
    claims_locales_supported: e.z.array(e.z.string()).optional(),
    claims_parameter_supported: e.z.boolean().optional(),
    request_parameter_supported: e.z.boolean().optional(),
    request_uri_parameter_supported: e.z.boolean().optional(),
    require_request_uri_registration: e.z.boolean().optional(),
    scopes_supported: e.z.array(e.z.string()).optional(),
    subject_types_supported: e.z.array(e.z.string()).optional(),
    response_types_supported: e.z.array(e.z.string()).optional(),
    response_modes_supported: e.z.array(e.z.string()).optional(),
    grant_types_supported: e.z.array(e.z.string()).optional(),
    code_challenge_methods_supported: e.z.array(r.oauthCodeChallengeMethodSchema).min(1).optional(),
    ui_locales_supported: e.z.array(e.z.string()).optional(),
    id_token_signing_alg_values_supported: e.z.array(e.z.string()).optional(),
    display_values_supported: e.z.array(e.z.string()).optional(),
    request_object_signing_alg_values_supported: e.z.array(e.z.string()).optional(),
    authorization_response_iss_parameter_supported: e.z.boolean().optional(),
    authorization_details_types_supported: e.z.array(e.z.string()).optional(),
    request_object_encryption_alg_values_supported: e.z.array(e.z.string()).optional(),
    request_object_encryption_enc_values_supported: e.z.array(e.z.string()).optional(),
    jwks_uri: s.webUriSchema.optional(),
    authorization_endpoint: s.webUriSchema,
    // .optional(),
    token_endpoint: s.webUriSchema,
    // .optional(),
    // https://www.rfc-editor.org/rfc/rfc8414.html#section-2
    token_endpoint_auth_methods_supported: e.z.array(e.z.string()).default(["client_secret_basic"]),
    token_endpoint_auth_signing_alg_values_supported: e.z.array(e.z.string()).optional(),
    revocation_endpoint: s.webUriSchema.optional(),
    introspection_endpoint: s.webUriSchema.optional(),
    pushed_authorization_request_endpoint: s.webUriSchema.optional(),
    require_pushed_authorization_requests: e.z.boolean().optional(),
    userinfo_endpoint: s.webUriSchema.optional(),
    end_session_endpoint: s.webUriSchema.optional(),
    registration_endpoint: s.webUriSchema.optional(),
    // https://datatracker.ietf.org/doc/html/rfc9449#section-5.1
    dpop_signing_alg_values_supported: e.z.array(e.z.string()).optional(),
    // https://www.rfc-editor.org/rfc/rfc9728.html#section-4
    protected_resources: e.z.array(s.webUriSchema).optional(),
    // https://www.ietf.org/archive/id/draft-ietf-oauth-client-id-metadata-document-00.html
    client_id_metadata_document_supported: e.z.boolean().optional()
  }), t.oauthAuthorizationServerMetadataValidator = t.oauthAuthorizationServerMetadataSchema.superRefine((a, o) => {
    a.require_pushed_authorization_requests && !a.pushed_authorization_request_endpoint && o.addIssue({
      code: e.z.ZodIssueCode.custom,
      message: '"pushed_authorization_request_endpoint" required when "require_pushed_authorization_requests" is true'
    });
  }).superRefine((a, o) => {
    a.response_types_supported && (a.response_types_supported.includes("code") || o.addIssue({
      code: e.z.ZodIssueCode.custom,
      message: 'Response type "code" is required'
    }));
  }).superRefine((a, o) => {
    var i;
    (i = a.token_endpoint_auth_signing_alg_values_supported) != null && i.includes("none") && o.addIssue({
      code: e.z.ZodIssueCode.custom,
      message: 'Client authentication method "none" is not allowed'
    });
  });
})(ql);
var as = {};
Object.defineProperty(as, "__esModule", { value: !0 });
as.oauthClientCredentialsGrantTokenRequestSchema = void 0;
const ud = R;
as.oauthClientCredentialsGrantTokenRequestSchema = ud.z.object({
  grant_type: ud.z.literal("client_credentials")
});
var Gl = {};
(function(t) {
  Object.defineProperty(t, "__esModule", { value: !0 }), t.oauthClientCredentialsSchema = t.oauthClientCredentialsNoneSchema = t.oauthClientCredentialsSecretPostSchema = t.oauthClientCredentialsJwtBearerSchema = void 0;
  const e = R, r = ct, n = Zn, s = wt;
  t.oauthClientCredentialsJwtBearerSchema = e.z.object({
    client_id: s.oauthClientIdSchema,
    client_assertion_type: e.z.literal(n.CLIENT_ASSERTION_TYPE_JWT_BEARER),
    /**
     * - "sub" the subject MUST be the "client_id" of the OAuth client
     * - "iat" is required and MUST be less than one minute
     * - "aud" must containing a value that identifies the authorization server
     * - The JWT MAY contain a "jti" (JWT ID) claim that provides a unique identifier for the token.
     * - Note that the authorization server may reject JWTs with an "exp" claim value that is unreasonably far in the future.
     *
     * @see {@link https://datatracker.ietf.org/doc/html/rfc7523#section-3}
     */
    client_assertion: r.signedJwtSchema
  }), t.oauthClientCredentialsSecretPostSchema = e.z.object({
    client_id: s.oauthClientIdSchema,
    client_secret: e.z.string()
  }), t.oauthClientCredentialsNoneSchema = e.z.object({
    client_id: s.oauthClientIdSchema
  }), t.oauthClientCredentialsSchema = e.z.union([
    t.oauthClientCredentialsJwtBearerSchema,
    t.oauthClientCredentialsSecretPostSchema,
    // Must be last since it is less specific
    t.oauthClientCredentialsNoneSchema
  ]);
})(Gl);
var Yl = {};
(function(t) {
  Object.defineProperty(t, "__esModule", { value: !0 }), t.conventionalOAuthClientIdSchema = t.oauthClientIdDiscoverableSchema = void 0, t.isOAuthClientIdDiscoverable = a, t.isConventionalOAuthClientId = o, t.assertOAuthDiscoverableClientId = i, t.parseOAuthDiscoverableClientId = c;
  const e = R, r = wt, n = gt, s = G;
  t.oauthClientIdDiscoverableSchema = e.z.intersection(r.oauthClientIdSchema, n.httpsUriSchema).superRefine((d, u) => {
    const l = new URL(d);
    return l.username || l.password ? (u.addIssue({
      code: e.z.ZodIssueCode.custom,
      message: "ClientID must not contain credentials"
    }), !1) : l.hash ? (u.addIssue({
      code: e.z.ZodIssueCode.custom,
      message: "ClientID must not contain a fragment"
    }), !1) : l.pathname === "/" ? (u.addIssue({
      code: e.z.ZodIssueCode.custom,
      message: 'ClientID must contain a path component (e.g. "/client-metadata.json")'
    }), !1) : l.pathname.endsWith("/") ? (u.addIssue({
      code: e.z.ZodIssueCode.custom,
      message: "ClientID path must not end with a trailing slash"
    }), !1) : (0, s.isHostnameIP)(l.hostname) ? (u.addIssue({
      code: e.z.ZodIssueCode.custom,
      message: "ClientID hostname must not be an IP address"
    }), !1) : (0, s.extractUrlPath)(d) !== l.pathname ? (u.addIssue({
      code: e.z.ZodIssueCode.custom,
      message: `ClientID must be in canonical form ("${l.href}", got "${d}")`
    }), !1) : !0;
  });
  function a(d) {
    return t.oauthClientIdDiscoverableSchema.safeParse(d).success;
  }
  t.conventionalOAuthClientIdSchema = t.oauthClientIdDiscoverableSchema.superRefine((d, u) => {
    const l = new URL(d);
    return l.port ? (u.addIssue({
      code: e.z.ZodIssueCode.custom,
      message: "ClientID must not contain a port"
    }), !1) : l.search ? (u.addIssue({
      code: e.z.ZodIssueCode.custom,
      message: "ClientID must not contain a query string"
    }), !1) : l.pathname !== "/oauth-client-metadata.json" ? (u.addIssue({
      code: e.z.ZodIssueCode.custom,
      message: 'ClientID must be "/oauth-client-metadata.json"'
    }), !1) : !0;
  });
  function o(d) {
    return t.conventionalOAuthClientIdSchema.safeParse(d).success;
  }
  function i(d) {
    t.oauthClientIdDiscoverableSchema.parse(d);
  }
  function c(d) {
    return new URL(t.oauthClientIdDiscoverableSchema.parse(d));
  }
})(Yl);
var co = {}, os = {};
Object.defineProperty(os, "__esModule", { value: !0 });
os.oauthEndpointAuthMethod = void 0;
const Rv = R;
os.oauthEndpointAuthMethod = Rv.z.enum([
  "client_secret_basic",
  "client_secret_jwt",
  "client_secret_post",
  "none",
  "private_key_jwt",
  "self_signed_tls_client_auth",
  "tls_client_auth"
]);
var is = {};
Object.defineProperty(is, "__esModule", { value: !0 });
is.oauthGrantTypeSchema = void 0;
const kv = R;
is.oauthGrantTypeSchema = kv.z.enum([
  "authorization_code",
  "implicit",
  "refresh_token",
  "password",
  // Not part of OAuth 2.1
  "client_credentials",
  "urn:ietf:params:oauth:grant-type:jwt-bearer",
  "urn:ietf:params:oauth:grant-type:saml2-bearer"
]);
Object.defineProperty(co, "__esModule", { value: !0 });
co.oauthClientMetadataSchema = void 0;
const V = R, jv = ct, Dv = wt, zv = os, $v = is, Mv = ir, Uv = xr, Kv = Mr, Qr = gt;
co.oauthClientMetadataSchema = V.z.object({
  /**
   * @note redirect_uris require additional validation
   */
  // https://www.rfc-editor.org/rfc/rfc7591.html#section-2
  redirect_uris: V.z.array(Mv.oauthRedirectUriSchema).nonempty(),
  response_types: V.z.array(Uv.oauthResponseTypeSchema).nonempty().default(["code"]),
  grant_types: V.z.array($v.oauthGrantTypeSchema).nonempty().default(["authorization_code"]),
  scope: Kv.oauthScopeSchema.optional(),
  // https://www.rfc-editor.org/rfc/rfc7591.html#section-2
  token_endpoint_auth_method: zv.oauthEndpointAuthMethod.default("client_secret_basic"),
  token_endpoint_auth_signing_alg: V.z.string().optional(),
  userinfo_signed_response_alg: V.z.string().optional(),
  userinfo_encrypted_response_alg: V.z.string().optional(),
  jwks_uri: Qr.webUriSchema.optional(),
  jwks: jv.jwksPubSchema.optional(),
  application_type: V.z.enum(["web", "native"]).default("web"),
  // default, per spec, is "web"
  subject_type: V.z.enum(["public", "pairwise"]).default("public"),
  request_object_signing_alg: V.z.string().optional(),
  id_token_signed_response_alg: V.z.string().optional(),
  authorization_signed_response_alg: V.z.string().default("RS256"),
  authorization_encrypted_response_enc: V.z.enum(["A128CBC-HS256"]).optional(),
  authorization_encrypted_response_alg: V.z.string().optional(),
  client_id: Dv.oauthClientIdSchema.optional(),
  client_name: V.z.string().optional(),
  client_uri: Qr.webUriSchema.optional(),
  policy_uri: Qr.webUriSchema.optional(),
  tos_uri: Qr.webUriSchema.optional(),
  logo_uri: Qr.webUriSchema.optional(),
  // @TODO: allow data: uri ?
  /**
   * Default Maximum Authentication Age. Specifies that the End-User MUST be
   * actively authenticated if the End-User was authenticated longer ago than
   * the specified number of seconds. The max_age request parameter overrides
   * this default value. If omitted, no default Maximum Authentication Age is
   * specified.
   */
  default_max_age: V.z.number().optional(),
  require_auth_time: V.z.boolean().optional(),
  contacts: V.z.array(V.z.string().email()).optional(),
  tls_client_certificate_bound_access_tokens: V.z.boolean().optional(),
  // https://datatracker.ietf.org/doc/html/rfc9449#section-5.2
  dpop_bound_access_tokens: V.z.boolean().optional(),
  // https://datatracker.ietf.org/doc/html/rfc9396#section-14.5
  authorization_details_types: V.z.array(V.z.string()).optional()
});
var uo = {};
Object.defineProperty(uo, "__esModule", { value: !0 });
uo.OAUTH_ENDPOINT_NAMES = void 0;
uo.OAUTH_ENDPOINT_NAMES = [
  "token",
  "revocation",
  "introspection",
  "pushed_authorization_request"
];
var Xl = {};
Object.defineProperty(Xl, "__esModule", { value: !0 });
var lo = {};
Object.defineProperty(lo, "__esModule", { value: !0 });
lo.oauthParResponseSchema = void 0;
const ei = R;
lo.oauthParResponseSchema = ei.z.object({
  request_uri: ei.z.string(),
  expires_in: ei.z.number().int().positive()
});
var cs = {};
Object.defineProperty(cs, "__esModule", { value: !0 });
cs.oauthPasswordGrantTokenRequestSchema = void 0;
const Ns = R;
cs.oauthPasswordGrantTokenRequestSchema = Ns.z.object({
  grant_type: Ns.z.literal("password"),
  username: Ns.z.string(),
  password: Ns.z.string()
});
var ho = {};
Object.defineProperty(ho, "__esModule", { value: !0 });
ho.oauthProtectedResourceMetadataSchema = void 0;
const bt = R, xv = Lr, en = gt;
ho.oauthProtectedResourceMetadataSchema = bt.z.object({
  /**
   * REQUIRED. The protected resource's resource identifier, which is a URL that
   * uses the https scheme and has no query or fragment components. Using these
   * well-known resources is described in Section 3.
   *
   * @note This schema allows non https URLs for testing & development purposes.
   * Make sure to validate the URL before using it in a production environment.
   */
  resource: en.webUriSchema.refine((t) => !t.includes("?"), {
    message: "Resource URL must not contain query parameters"
  }).refine((t) => !t.includes("#"), {
    message: "Resource URL must not contain a fragment"
  }),
  /**
   * OPTIONAL. JSON array containing a list of OAuth authorization server issuer
   * identifiers, as defined in [RFC8414], for authorization servers that can be
   * used with this protected resource. Protected resources MAY choose not to
   * advertise some supported authorization servers even when this parameter is
   * used. In some use cases, the set of authorization servers will not be
   * enumerable, in which case this metadata parameter would not be used.
   */
  authorization_servers: bt.z.array(xv.oauthIssuerIdentifierSchema).optional(),
  /**
   * OPTIONAL. URL of the protected resource's JWK Set [JWK] document. This
   * contains public keys belonging to the protected resource, such as signing
   * key(s) that the resource server uses to sign resource responses. This URL
   * MUST use the https scheme. When both signing and encryption keys are made
   * available, a use (public key use) parameter value is REQUIRED for all keys
   * in the referenced JWK Set to indicate each key's intended usage.
   */
  jwks_uri: en.webUriSchema.optional(),
  /**
   * RECOMMENDED. JSON array containing a list of the OAuth 2.0 [RFC6749] scope
   * values that are used in authorization requests to request access to this
   * protected resource. Protected resources MAY choose not to advertise some
   * scope values supported even when this parameter is used.
   */
  scopes_supported: bt.z.array(bt.z.string()).optional(),
  /**
   * OPTIONAL. JSON array containing a list of the supported methods of sending
   * an OAuth 2.0 Bearer Token [RFC6750] to the protected resource. Defined
   * values are ["header", "body", "query"], corresponding to Sections 2.1, 2.2,
   * and 2.3 of RFC 6750.
   */
  bearer_methods_supported: bt.z.array(bt.z.enum(["header", "body", "query"])).optional(),
  /**
   * OPTIONAL. JSON array containing a list of the JWS [JWS] signing algorithms
   * (alg values) [JWA] supported by the protected resource for signing resource
   * responses, for instance, as described in [FAPI.MessageSigning]. No default
   * algorithms are implied if this entry is omitted. The value none MUST NOT be
   * used.
   */
  resource_signing_alg_values_supported: bt.z.array(bt.z.string()).optional(),
  /**
   * OPTIONAL. URL of a page containing human-readable information that
   * developers might want or need to know when using the protected resource
   */
  resource_documentation: en.webUriSchema.optional(),
  /**
   * OPTIONAL. URL that the protected resource provides to read about the
   * protected resource's requirements on how the client can use the data
   * provided by the protected resource
   */
  resource_policy_uri: en.webUriSchema.optional(),
  /**
   * OPTIONAL. URL that the protected resource provides to read about the
   * protected resource's terms of service
   */
  resource_tos_uri: en.webUriSchema.optional()
});
var ds = {}, Nr = {};
Object.defineProperty(Nr, "__esModule", { value: !0 });
Nr.oauthRefreshTokenSchema = void 0;
const Lv = R;
Nr.oauthRefreshTokenSchema = Lv.z.string().min(1);
Object.defineProperty(ds, "__esModule", { value: !0 });
ds.oauthRefreshTokenGrantTokenRequestSchema = void 0;
const ld = R, Nv = Nr;
ds.oauthRefreshTokenGrantTokenRequestSchema = ld.z.object({
  grant_type: ld.z.literal("refresh_token"),
  refresh_token: Nv.oauthRefreshTokenSchema
});
var fo = {};
Object.defineProperty(fo, "__esModule", { value: !0 });
fo.oauthTokenIdentificationSchema = void 0;
const ti = R, Wv = Gn, Hv = Nr;
fo.oauthTokenIdentificationSchema = ti.z.object({
  token: ti.z.union([Wv.oauthAccessTokenSchema, Hv.oauthRefreshTokenSchema]),
  token_type_hint: ti.z.enum(["access_token", "refresh_token"]).optional()
});
var po = {};
Object.defineProperty(po, "__esModule", { value: !0 });
po.oauthTokenRequestSchema = void 0;
const Jv = R, Zv = Yn, Fv = as, Bv = cs, Vv = ds;
po.oauthTokenRequestSchema = Jv.z.discriminatedUnion("grant_type", [
  Zv.oauthAuthorizationCodeGrantTokenRequestSchema,
  Vv.oauthRefreshTokenGrantTokenRequestSchema,
  Bv.oauthPasswordGrantTokenRequestSchema,
  Fv.oauthClientCredentialsGrantTokenRequestSchema
]);
var yo = {};
Object.defineProperty(yo, "__esModule", { value: !0 });
yo.oidcAuthorizationResponseErrorSchema = void 0;
const qv = R;
yo.oidcAuthorizationResponseErrorSchema = qv.z.enum([
  // The Authorization Server requires End-User interaction of some form to proceed. This error MAY be returned when the prompt parameter value in the Authentication Request is none, but the Authentication Request cannot be completed without displaying a user interface for End-User interaction.
  "interaction_required",
  // The Authorization Server requires End-User authentication. This error MAY be returned when the prompt parameter value in the Authentication Request is none, but the Authentication Request cannot be completed without displaying a user interface for End-User authentication.
  "login_required",
  // The End-User is REQUIRED to select a session at the Authorization Server. The End-User MAY be authenticated at the Authorization Server with different associated accounts, but the End-User did not select a session. This error MAY be returned when the prompt parameter value in the Authentication Request is none, but the Authentication Request cannot be completed without displaying a user interface to prompt for a session to use.
  "account_selection_required",
  // The Authorization Server requires End-User consent. This error MAY be returned when the prompt parameter value in the Authentication Request is none, but the Authentication Request cannot be completed without displaying a user interface for End-User consent.
  "consent_required",
  // The request_uri in the Authorization Request returns an error or contains invalid data.
  "invalid_request_uri",
  // The request parameter contains an invalid Request Object.
  "invalid_request_object",
  // The OP does not support use of the request parameter defined in Section 6.
  "request_not_supported",
  // The OP does not support use of the request_uri parameter defined in Section 6.
  "request_uri_not_supported",
  // The OP does not support use of the registration parameter defined in Section 7.2.1.
  "registration_not_supported"
]);
var mo = {};
Object.defineProperty(mo, "__esModule", { value: !0 });
mo.oidcUserinfoSchema = void 0;
const Ue = R;
mo.oidcUserinfoSchema = Ue.z.object({
  sub: Ue.z.string(),
  iss: Ue.z.string().url().optional(),
  aud: Ue.z.union([Ue.z.string(), Ue.z.array(Ue.z.string()).min(1)]).optional(),
  email: Ue.z.string().email().optional(),
  email_verified: Ue.z.boolean().optional(),
  name: Ue.z.string().optional(),
  preferred_username: Ue.z.string().optional(),
  picture: Ue.z.string().url().optional()
});
(function(t) {
  var e = v && v.__createBinding || (Object.create ? function(n, s, a, o) {
    o === void 0 && (o = a);
    var i = Object.getOwnPropertyDescriptor(s, a);
    (!i || ("get" in i ? !s.__esModule : i.writable || i.configurable)) && (i = { enumerable: !0, get: function() {
      return s[a];
    } }), Object.defineProperty(n, o, i);
  } : function(n, s, a, o) {
    o === void 0 && (o = a), n[o] = s[a];
  }), r = v && v.__exportStar || function(n, s) {
    for (var a in n) a !== "default" && !Object.prototype.hasOwnProperty.call(s, a) && e(s, n, a);
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), r(Zn, t), r(gt, t), r(G, t), r(Fn, t), r(ro, t), r(Bn, t), r(to, t), r(no, t), r(Gn, t), r(Yn, t), r(so, t), r(Ur, t), r(ao, t), r(Kr, t), r(oo, t), r(ns, t), r(io, t), r(ql, t), r(as, t), r(Gl, t), r(Yl, t), r(yc, t), r(wt, t), r(co, t), r(os, t), r(uo, t), r(is, t), r(Xl, t), r(Lr, t), r(lo, t), r(cs, t), r(ho, t), r(ir, t), r(ds, t), r(Nr, t), r(ss, t), r(Qn, t), r(xr, t), r(Mr, t), r(fo, t), r(po, t), r(Vn, t), r(qn, t), r(yo, t), r(es, t), r(ts, t), r(rs, t), r(mo, t);
})(xe);
var us = {};
Object.defineProperty(us, "__esModule", { value: !0 });
us.requestLocalLock = void 0;
const Ws = /* @__PURE__ */ new Map();
function Gv(t) {
  return new Promise((e) => {
    const n = (Ws.get(t) ?? Promise.resolve()).then(() => new Promise((s) => {
      e(() => {
        Ws.get(t) === n && Ws.delete(t), s();
      });
    }));
    Ws.set(t, n);
  });
}
const Yv = (t, e) => Gv(t).then(async (r) => {
  try {
    return await e();
  } finally {
    r();
  }
});
us.requestLocalLock = Yv;
var ls = {}, Wr = {};
(function(t) {
  var e = v && v.__classPrivateFieldSet || function(c, d, u, l, p) {
    if (l === "m") throw new TypeError("Private method is not writable");
    if (l === "a" && !p) throw new TypeError("Private accessor was defined without a setter");
    if (typeof d == "function" ? c !== d || !p : !d.has(c)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return l === "a" ? p.call(c, u) : p ? p.value = u : d.set(c, u), u;
  }, r = v && v.__classPrivateFieldGet || function(c, d, u, l) {
    if (u === "a" && !l) throw new TypeError("Private accessor was defined without a getter");
    if (typeof d == "function" ? c !== d || !l : !d.has(c)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return u === "m" ? l : u === "a" ? l.call(c) : l ? l.value : d.get(c);
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), t.CustomEventTarget = t.CustomEvent = t.ifString = void 0, t.contentMime = s, t.combineSignals = o;
  const n = (c) => typeof c == "string" ? c : void 0;
  t.ifString = n;
  function s(c) {
    var d;
    return (d = c.get("content-type")) == null ? void 0 : d.split(";")[0].trim();
  }
  t.CustomEvent = globalThis.CustomEvent ?? (() => {
    var c;
    class d extends Event {
      constructor(l, p) {
        if (!arguments.length)
          throw new TypeError("type argument is required");
        super(l, p), c.set(this, void 0), e(this, c, (p == null ? void 0 : p.detail) ?? null, "f");
      }
      get detail() {
        return r(this, c, "f");
      }
    }
    return c = /* @__PURE__ */ new WeakMap(), Object.defineProperties(d.prototype, {
      [Symbol.toStringTag]: {
        writable: !1,
        enumerable: !1,
        configurable: !0,
        value: "CustomEvent"
      },
      detail: {
        enumerable: !0
      }
    }), d;
  })();
  class a {
    constructor() {
      Object.defineProperty(this, "eventTarget", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: new EventTarget()
      });
    }
    addEventListener(d, u, l) {
      this.eventTarget.addEventListener(d, u, l);
    }
    removeEventListener(d, u, l) {
      this.eventTarget.removeEventListener(d, u, l);
    }
    dispatchCustomEvent(d, u, l) {
      return this.eventTarget.dispatchEvent(new t.CustomEvent(d, { ...l, detail: u }));
    }
  }
  t.CustomEventTarget = a;
  function o(c) {
    const d = new i(), u = function(l) {
      const p = new Error("This operation was aborted", {
        cause: this.reason
      });
      d.abort(p);
    };
    try {
      for (const l of c)
        l && (l.throwIfAborted(), l.addEventListener("abort", u, { signal: d.signal }));
      return d;
    } catch (l) {
      throw d.abort(l), l;
    }
  }
  class i extends AbortController {
    [Symbol.dispose]() {
      this.abort(new Error("AbortController was disposed"));
    }
  }
})(Wr);
Object.defineProperty(ls, "__esModule", { value: !0 });
ls.OAuthAuthorizationServerMetadataResolver = void 0;
const hd = xe, tn = ut, Xv = Rr, Qv = Wr;
class eb extends Xv.CachedGetter {
  constructor(e, r, n) {
    super(async (s, a) => this.fetchMetadata(s, a), e), Object.defineProperty(this, "fetch", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "allowHttpIssuer", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.fetch = (0, tn.bindFetch)(r), this.allowHttpIssuer = (n == null ? void 0 : n.allowHttpIssuer) === !0;
  }
  async get(e, r) {
    const n = hd.oauthIssuerIdentifierSchema.parse(e);
    if (!this.allowHttpIssuer && n.startsWith("http:"))
      throw new TypeError("Unsecure issuer URL protocol only allowed in development and test environments");
    return super.get(n, r);
  }
  async fetchMetadata(e, r) {
    const n = new URL("/.well-known/oauth-authorization-server", e), s = new Request(n, {
      headers: { accept: "application/json" },
      cache: r != null && r.noCache ? "no-cache" : void 0,
      signal: r == null ? void 0 : r.signal,
      redirect: "manual"
      // response must be 200 OK
    }), a = await this.fetch(s);
    if (a.status !== 200)
      throw await (0, tn.cancelBody)(a, "log"), await tn.FetchResponseError.from(a, `Unexpected status code ${a.status} for "${n}"`, void 0, { cause: s });
    if ((0, Qv.contentMime)(a.headers) !== "application/json")
      throw await (0, tn.cancelBody)(a, "log"), await tn.FetchResponseError.from(a, `Unexpected content type for "${n}"`, void 0, { cause: s });
    const o = hd.oauthAuthorizationServerMetadataValidator.parse(await a.json());
    if (o.issuer !== e)
      throw new TypeError(`Invalid issuer ${o.issuer}`);
    if (o.client_id_metadata_document_supported !== !0)
      throw new TypeError(`Authorization server "${e}" does not support client_id_metadata_document`);
    return o;
  }
}
ls.OAuthAuthorizationServerMetadataResolver = eb;
var hs = {};
Object.defineProperty(hs, "__esModule", { value: !0 });
hs.OAuthCallbackError = void 0;
class ga extends Error {
  static from(e, r, n) {
    if (e instanceof ga)
      return e;
    const s = e instanceof Error ? e.message : void 0;
    return new ga(r, s, n, e);
  }
  constructor(e, r = e.get("error_description") || "OAuth callback error", n, s) {
    super(r, { cause: s }), Object.defineProperty(this, "params", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: e
    }), Object.defineProperty(this, "state", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: n
    });
  }
}
hs.OAuthCallbackError = ga;
var Ql = {}, mc = {}, _o = {}, fs = {};
Object.defineProperty(fs, "__esModule", { value: !0 });
fs.HANDLE_INVALID = void 0;
fs.HANDLE_INVALID = "handle.invalid";
var ps = {};
Object.defineProperty(ps, "__esModule", { value: !0 });
ps.IdentityResolverError = void 0;
class tb extends Error {
  constructor() {
    super(...arguments), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "IdentityResolverError"
    });
  }
}
ps.IdentityResolverError = tb;
var Nt = {};
Object.defineProperty(Nt, "__esModule", { value: !0 });
Nt.extractAtprotoHandle = eh;
Nt.extractNormalizedHandle = rb;
Nt.asNormalizedHandle = th;
Nt.normalizeHandle = rh;
Nt.isValidHandle = nh;
function eh(t) {
  if (t.alsoKnownAs) {
    for (const e of t.alsoKnownAs)
      if (e.startsWith("at://"))
        return e.slice(5);
  }
}
function rb(t) {
  const e = eh(t);
  if (e)
    return th(e);
}
function th(t) {
  const e = rh(t);
  return nh(e) ? e : void 0;
}
function rh(t) {
  return t.toLowerCase();
}
function nh(t) {
  return t.length > 0 && t.length < 254 && /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(t);
}
Object.defineProperty(_o, "__esModule", { value: !0 });
_o.AtprotoIdentityResolver = void 0;
const nb = Kn, fd = fs, ri = ps, Hs = Nt;
class sb {
  constructor(e, r) {
    Object.defineProperty(this, "didResolver", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: e
    }), Object.defineProperty(this, "handleResolver", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: r
    });
  }
  async resolve(e, r) {
    return (0, nb.isAtprotoDid)(e) ? this.resolveFromDid(e, r) : this.resolveFromHandle(e, r);
  }
  async resolveFromDid(e, r) {
    var o;
    const n = await this.getDocumentFromDid(e, r);
    (o = r == null ? void 0 : r.signal) == null || o.throwIfAborted();
    const s = (0, Hs.extractNormalizedHandle)(n), a = s ? await this.handleResolver.resolve(s, r).catch(() => {
    }) : void 0;
    return {
      did: n.id,
      didDoc: n,
      handle: s && a === e ? s : fd.HANDLE_INVALID
    };
  }
  async resolveFromHandle(e, r) {
    const n = await this.getDocumentFromHandle(e, r);
    return {
      did: n.id,
      didDoc: n,
      handle: (0, Hs.extractNormalizedHandle)(n) || fd.HANDLE_INVALID
    };
  }
  async getDocumentFromDid(e, r) {
    return this.didResolver.resolve(e, r);
  }
  async getDocumentFromHandle(e, r) {
    var o;
    const n = (0, Hs.asNormalizedHandle)(e);
    if (!n)
      throw new ri.IdentityResolverError(`Invalid handle "${e}" provided.`);
    const s = await this.handleResolver.resolve(n, r);
    if (!s)
      throw new ri.IdentityResolverError(`Handle "${n}" does not resolve to a DID`);
    (o = r == null ? void 0 : r.signal) == null || o.throwIfAborted();
    const a = await this.didResolver.resolve(s, r);
    if (n !== (0, Hs.extractNormalizedHandle)(a))
      throw new ri.IdentityResolverError(`Did document for "${s}" does not include the handle "${n}"`);
    return a;
  }
}
_o.AtprotoIdentityResolver = sb;
var sh = {};
Object.defineProperty(sh, "__esModule", { value: !0 });
(function(t) {
  var e = v && v.__createBinding || (Object.create ? function(n, s, a, o) {
    o === void 0 && (o = a);
    var i = Object.getOwnPropertyDescriptor(s, a);
    (!i || ("get" in i ? !s.__esModule : i.writable || i.configurable)) && (i = { enumerable: !0, get: function() {
      return s[a];
    } }), Object.defineProperty(n, o, i);
  } : function(n, s, a, o) {
    o === void 0 && (o = a), n[o] = s[a];
  }), r = v && v.__exportStar || function(n, s) {
    for (var a in n) a !== "default" && !Object.prototype.hasOwnProperty.call(s, a) && e(s, n, a);
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), r(_o, t), r(fs, t), r(ps, t), r(sh, t), r(Nt, t);
})(mc);
var Hr = {};
Object.defineProperty(Hr, "__esModule", { value: !0 });
Hr.FALLBACK_ALG = void 0;
Hr.FALLBACK_ALG = "ES256";
var Jr = {};
Object.defineProperty(Jr, "__esModule", { value: !0 });
Jr.AuthMethodUnsatisfiableError = void 0;
class ab extends Error {
}
Jr.AuthMethodUnsatisfiableError = ab;
var cr = {};
Object.defineProperty(cr, "__esModule", { value: !0 });
cr.TokenRevokedError = void 0;
class ob extends Error {
  constructor(e, r = `The session for "${e}" was successfully revoked`, n) {
    super(r, n), Object.defineProperty(this, "sub", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: e
    });
  }
}
cr.TokenRevokedError = ob;
var _c = {};
Object.defineProperty(_c, "__esModule", { value: !0 });
_c.createIdentityResolver = cb;
const ni = Kn, si = pc, ib = mc;
function cb(t) {
  const { identityResolver: e } = t;
  if (e != null)
    return e;
  const r = db(t), n = ub(t);
  return new ib.AtprotoIdentityResolver(r, n);
}
function db(t) {
  const { didResolver: e, didCache: r } = t;
  return e instanceof ni.DidResolverCached && !r ? e : new ni.DidResolverCached(e ?? new ni.DidResolverCommon(t), r);
}
function ub(t) {
  const { handleResolver: e, handleCache: r } = t;
  if (e == null)
    throw new TypeError("handleResolver is required");
  return e instanceof si.CachedHandleResolver && !r ? e : new si.CachedHandleResolver(typeof e == "string" || e instanceof URL ? new si.XrpcHandleResolver(e, t) : e, r);
}
var Zr = {};
Object.defineProperty(Zr, "__esModule", { value: !0 });
Zr.negotiateClientAuthMethod = hb;
Zr.createClientCredentialsFactory = fb;
const lb = xe, ea = Hr, ai = Jr;
function hb(t, e, r) {
  const n = e.token_endpoint_auth_method, s = ah(t);
  if (!s.includes(n))
    throw new Error(`The server does not support "${n}" authentication. Supported methods are: ${s.join(", ")}.`);
  if (n === "private_key_jwt") {
    if (!r)
      throw new Error("A keyset is required for private_key_jwt");
    const a = oh(t);
    for (const o of r.list({ alg: a, usage: "sign" }))
      if (o.kid)
        return { method: "private_key_jwt", kid: o.kid };
    throw new Error(a.includes(ea.FALLBACK_ALG) ? `Client authentication method "${n}" requires at least one "${ea.FALLBACK_ALG}" signing key with a "kid" property` : (
      // AS is not compliant with the ATproto OAuth spec.
      `Authorization server requires "${n}" authentication method, but does not support "${ea.FALLBACK_ALG}" algorithm.`
    ));
  }
  if (n === "none")
    return { method: "none" };
  throw new Error('The ATProto OAuth spec requires that client use either "none" or "private_key_jwt" authentication method.' + (n === "client_secret_basic" ? ' You might want to explicitly set "token_endpoint_auth_method" to one of those values in the client metadata document.' : ` You set "${n}" which is not allowed.`));
}
function fb(t, e, r, n, s) {
  if (!ah(e).includes(t.method))
    throw new ai.AuthMethodUnsatisfiableError(`Client authentication method "${t.method}" no longer supported`);
  if (t.method === "none")
    return () => ({
      payload: {
        client_id: r.client_id
      }
    });
  if (t.method === "private_key_jwt")
    try {
      if (!s)
        throw new Error("A keyset is required for private_key_jwt");
      const { key: a, alg: o } = s.findPrivateKey({
        usage: "sign",
        kid: t.kid,
        alg: oh(e)
      });
      return async () => ({
        payload: {
          client_id: r.client_id,
          client_assertion_type: lb.CLIENT_ASSERTION_TYPE_JWT_BEARER,
          client_assertion: await a.createJwt({ alg: o }, {
            // > The JWT MUST contain an "iss" (issuer) claim that contains a
            // > unique identifier for the entity that issued the JWT.
            iss: r.client_id,
            // > For client authentication, the subject MUST be the
            // > "client_id" of the OAuth client.
            sub: r.client_id,
            // > The JWT MUST contain an "aud" (audience) claim containing a value
            // > that identifies the authorization server as an intended audience.
            // > The token endpoint URL of the authorization server MAY be used as a
            // > value for an "aud" element to identify the authorization server as an
            // > intended audience of the JWT.
            aud: e.issuer,
            // > The JWT MAY contain a "jti" (JWT ID) claim that provides a
            // > unique identifier for the token.
            jti: await n.generateNonce(),
            // > The JWT MAY contain an "iat" (issued at) claim that
            // > identifies the time at which the JWT was issued.
            iat: Math.floor(Date.now() / 1e3),
            // > The JWT MUST contain an "exp" (expiration time) claim that
            // > limits the time window during which the JWT can be used.
            exp: Math.floor(Date.now() / 1e3) + 60
            // 1 minute
          })
        }
      });
    } catch (a) {
      throw new ai.AuthMethodUnsatisfiableError("Failed to load private key", {
        cause: a
      });
    }
  throw new ai.AuthMethodUnsatisfiableError(
    // @ts-expect-error
    `Unsupported auth method ${t.method}`
  );
}
function ah(t) {
  return t.token_endpoint_auth_methods_supported;
}
function oh(t) {
  return t.token_endpoint_auth_signing_alg_values_supported ?? [
    // @NOTE If not specified, assume that the server supports the ES256
    // algorithm, as prescribed by the spec:
    //
    // > Clients and Authorization Servers currently must support the ES256
    // > cryptographic system [for client authentication].
    //
    // https://atproto.com/specs/oauth#confidential-client-authentication
    ea.FALLBACK_ALG
  ];
}
var ys = {};
Object.defineProperty(ys, "__esModule", { value: !0 });
ys.OAuthProtectedResourceMetadataResolver = void 0;
const pb = xe, rn = ut, yb = Rr, mb = Wr;
class _b extends yb.CachedGetter {
  constructor(e, r = globalThis.fetch, n) {
    super(async (s, a) => this.fetchMetadata(s, a), e), Object.defineProperty(this, "fetch", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "allowHttpResource", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.fetch = (0, rn.bindFetch)(r), this.allowHttpResource = (n == null ? void 0 : n.allowHttpResource) === !0;
  }
  async get(e, r) {
    const { protocol: n, origin: s } = new URL(e);
    if (n !== "https:" && n !== "http:")
      throw new TypeError(`Invalid protected resource metadata URL protocol: ${n}`);
    if (n === "http:" && !this.allowHttpResource)
      throw new TypeError(`Unsecure resource metadata URL (${n}) only allowed in development and test environments`);
    return super.get(s, r);
  }
  async fetchMetadata(e, r) {
    const n = new URL("/.well-known/oauth-protected-resource", e), s = new Request(n, {
      signal: r == null ? void 0 : r.signal,
      headers: { accept: "application/json" },
      cache: r != null && r.noCache ? "no-cache" : void 0,
      redirect: "manual"
      // response must be 200 OK
    }), a = await this.fetch(s);
    if (a.status !== 200)
      throw await (0, rn.cancelBody)(a, "log"), await rn.FetchResponseError.from(a, `Unexpected status code ${a.status} for "${n}"`, void 0, { cause: s });
    if ((0, mb.contentMime)(a.headers) !== "application/json")
      throw await (0, rn.cancelBody)(a, "log"), await rn.FetchResponseError.from(a, `Unexpected content type for "${n}"`, void 0, { cause: s });
    const o = pb.oauthProtectedResourceMetadataSchema.parse(await a.json());
    if (o.resource !== e)
      throw new TypeError(`Invalid issuer ${o.resource}`);
    return o;
  }
}
ys.OAuthProtectedResourceMetadataResolver = _b;
var go = {}, ms = {};
Object.defineProperty(ms, "__esModule", { value: !0 });
ms.OAuthResolverError = void 0;
const gb = R;
class wa extends Error {
  constructor(e, r) {
    super(e, r);
  }
  static from(e, r) {
    if (e instanceof wa)
      return e;
    const n = e instanceof gb.ZodError ? `${e.errors[0].path} ${e.errors[0].message}` : null, s = (r ?? "Unable to resolve identity") + (n ? ` (${n})` : "");
    return new wa(s, {
      cause: e
    });
  }
}
ms.OAuthResolverError = wa;
Object.defineProperty(go, "__esModule", { value: !0 });
go.OAuthResolver = void 0;
const wb = xe, kt = ms;
class vb {
  constructor(e, r, n) {
    Object.defineProperty(this, "identityResolver", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: e
    }), Object.defineProperty(this, "protectedResourceMetadataResolver", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: r
    }), Object.defineProperty(this, "authorizationServerMetadataResolver", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: n
    });
  }
  /**
   * @param input - A handle, DID, PDS URL or Entryway URL
   */
  async resolve(e, r) {
    return /^https?:\/\//.test(e) ? this.resolveFromService(e, r) : this.resolveFromIdentity(e, r);
  }
  /**
   * @note this method can be used to verify if a particular uri supports OAuth
   * based sign-in (for compatibility with legacy implementation).
   */
  async resolveFromService(e, r) {
    var n;
    try {
      return { metadata: await this.getResourceServerMetadata(e, r) };
    } catch (s) {
      if (!((n = r == null ? void 0 : r.signal) != null && n.aborted) && s instanceof kt.OAuthResolverError)
        try {
          const a = wb.oauthIssuerIdentifierSchema.safeParse(e);
          if (a.success)
            return { metadata: await this.getAuthorizationServerMetadata(a.data, r) };
        } catch {
        }
      throw s;
    }
  }
  async resolveFromIdentity(e, r) {
    var o;
    const n = await this.resolveIdentity(e, r);
    (o = r == null ? void 0 : r.signal) == null || o.throwIfAborted();
    const s = Sb(n.didDoc), a = await this.getResourceServerMetadata(s, r);
    return { identityInfo: n, metadata: a, pds: s };
  }
  async resolveIdentity(e, r) {
    try {
      return await this.identityResolver.resolve(e, r);
    } catch (n) {
      throw kt.OAuthResolverError.from(n, `Failed to resolve identity: ${e}`);
    }
  }
  async getAuthorizationServerMetadata(e, r) {
    try {
      return await this.authorizationServerMetadataResolver.get(e, r);
    } catch (n) {
      throw kt.OAuthResolverError.from(n, `Failed to resolve OAuth server metadata for issuer: ${e}`);
    }
  }
  async getResourceServerMetadata(e, r) {
    var n, s, a;
    try {
      const o = await this.protectedResourceMetadataResolver.get(e, r);
      if (((n = o.authorization_servers) == null ? void 0 : n.length) !== 1)
        throw new kt.OAuthResolverError((s = o.authorization_servers) != null && s.length ? `Unable to determine authorization server for PDS: ${e}` : `No authorization servers found for PDS: ${e}`);
      const i = o.authorization_servers[0];
      (a = r == null ? void 0 : r.signal) == null || a.throwIfAborted();
      const c = await this.getAuthorizationServerMetadata(i, r);
      if (c.protected_resources && !c.protected_resources.includes(o.resource))
        throw new kt.OAuthResolverError(`PDS "${e}" not protected by issuer "${i}"`);
      return c;
    } catch (o) {
      throw kt.OAuthResolverError.from(o, `Failed to resolve OAuth server metadata for resource: ${e}`);
    }
  }
}
go.OAuthResolver = vb;
function bb(t) {
  return typeof t.serviceEndpoint == "string" && t.type === "AtprotoPersonalDataServer" && (t.id.startsWith("#") ? t.id === "#atproto_pds" : t.id === `${this.id}#atproto_pds`);
}
function Sb(t) {
  var r;
  const e = (r = t.service) == null ? void 0 : r.find(bb, t);
  if (!e)
    throw new kt.OAuthResolverError(`Identity "${t.id}" does not have a PDS URL`);
  try {
    return new URL(e.serviceEndpoint);
  } catch (n) {
    throw new kt.OAuthResolverError(`Invalid PDS URL in DID document: ${e.serviceEndpoint}`, { cause: n });
  }
}
var _s = {}, gs = {}, Fr = {};
Object.defineProperty(Fr, "__esModule", { value: !0 });
Fr.TokenRefreshError = void 0;
class Eb extends Error {
  constructor(e, r, n) {
    super(r, n), Object.defineProperty(this, "sub", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: e
    });
  }
}
Fr.TokenRefreshError = Eb;
var wo = {};
Object.defineProperty(wo, "__esModule", { value: !0 });
wo.dpopFetchWrapper = Pb;
const Ab = Wi, ih = ut;
var Md;
const Mi = (Md = globalThis.crypto) == null ? void 0 : Md.subtle, pd = globalThis.ReadableStream;
function Pb({
  key: t,
  // @TODO we should provide a default based on specs
  supportedAlgs: e,
  nonces: r,
  sha256: n = typeof Mi < "u" ? Tb : void 0,
  isAuthServer: s,
  fetch: a = globalThis.fetch
}) {
  if (!n)
    throw new TypeError("crypto.subtle is not available in this environment. Please provide a sha256 function.");
  const o = Ob(t, e);
  return async function(i, c) {
    const d = c == null && i instanceof Request ? i : new Request(i, c), u = d.headers.get("Authorization"), l = u != null && u.startsWith("DPoP ") ? await n(u.slice(5)) : void 0, { origin: p } = new URL(d.url), f = d.method, _ = Ib(d.url);
    let g;
    try {
      g = await r.get(p);
    } catch {
    }
    const S = await yd(t, o, f, _, g, l);
    d.headers.set("DPoP", S);
    const w = await a.call(this, d), b = w.headers.get("DPoP-Nonce");
    if (!b || b === g)
      return w;
    try {
      await r.set(p, b);
    } catch {
    }
    if (!await Cb(w, s) || i === d || pd && (c == null ? void 0 : c.body) instanceof pd)
      return w;
    await (0, ih.cancelBody)(w, "log");
    const N = await yd(t, o, f, _, b, l), oe = new Request(i, c);
    oe.headers.set("DPoP", N);
    const Ce = await a.call(this, oe), T = Ce.headers.get("DPoP-Nonce");
    if (!T || T === g)
      return Ce;
    try {
      await r.set(p, T);
    } catch {
    }
    return Ce;
  };
}
function Ib(t) {
  const e = t.indexOf("#"), r = t.indexOf("?"), n = e === -1 ? r : r === -1 ? e : Math.min(e, r);
  return n === -1 ? t : t.slice(0, n);
}
async function yd(t, e, r, n, s, a) {
  const o = t.bareJwk;
  if (!o)
    throw new Error("Only asymmetric keys can be used as DPoP proofs");
  const i = Math.floor(Date.now() / 1e3);
  return t.createJwt(
    // https://datatracker.ietf.org/doc/html/rfc9449#section-4.2
    {
      alg: e,
      typ: "dpop+jwt",
      jwk: o
    },
    {
      iat: i,
      // Any collision will cause the request to be rejected by the server. no biggie.
      jti: Math.random().toString(36).slice(2),
      htm: r,
      htu: n,
      nonce: s,
      ath: a
    }
  );
}
async function Cb(t, e) {
  if ((e === void 0 || e === !1) && t.status === 401) {
    const r = t.headers.get("WWW-Authenticate");
    if (r != null && r.startsWith("DPoP"))
      return r.includes('error="use_dpop_nonce"');
  }
  if ((e === void 0 || e === !0) && t.status === 400)
    try {
      const r = await (0, ih.peekJson)(t, 10240);
      return typeof r == "object" && (r == null ? void 0 : r.error) === "use_dpop_nonce";
    } catch {
      return !1;
    }
  return !1;
}
function Ob(t, e) {
  if (e) {
    const r = e.find((n) => t.algorithms.includes(n));
    if (r)
      return r;
  } else {
    const [r] = t.algorithms;
    if (r)
      return r;
  }
  throw new Error("Key does not match any alg supported by the server");
}
async function Tb(t) {
  if (Mi == null)
    throw new Error("crypto.subtle is not available in this environment. Please provide a sha256 function.");
  const e = new TextEncoder().encode(t), r = await Mi.digest("SHA-256", e), n = new Uint8Array(r);
  return Ab.base64url.baseEncode(n);
}
var Br = {};
Object.defineProperty(Br, "__esModule", { value: !0 });
Br.OAuthResponseError = void 0;
const md = Wr;
class Rb extends Error {
  constructor(e, r) {
    const n = typeof r == "object" ? r : void 0, s = (0, md.ifString)(n == null ? void 0 : n.error), a = (0, md.ifString)(n == null ? void 0 : n.error_description), o = s ? `"${s}"` : "unknown", i = a ? `: ${a}` : "", c = `OAuth ${o} error${i}`;
    super(c), Object.defineProperty(this, "response", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: e
    }), Object.defineProperty(this, "payload", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: r
    }), Object.defineProperty(this, "error", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "errorDescription", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.error = s, this.errorDescription = a;
  }
  get status() {
    return this.response.status;
  }
  get headers() {
    return this.response.headers;
  }
}
Br.OAuthResponseError = Rb;
Object.defineProperty(gs, "__esModule", { value: !0 });
gs.OAuthServerAgent = void 0;
const _d = xe, gd = ut, kb = Fr, jb = wo, Db = Zr, zb = Br;
class $b {
  /**
   * @throws see {@link createClientCredentialsFactory}
   */
  constructor(e, r, n, s, a, o, i, c, d) {
    Object.defineProperty(this, "authMethod", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: e
    }), Object.defineProperty(this, "dpopKey", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: r
    }), Object.defineProperty(this, "serverMetadata", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: n
    }), Object.defineProperty(this, "clientMetadata", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: s
    }), Object.defineProperty(this, "dpopNonces", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: a
    }), Object.defineProperty(this, "oauthResolver", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: o
    }), Object.defineProperty(this, "runtime", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: i
    }), Object.defineProperty(this, "keyset", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: c
    }), Object.defineProperty(this, "dpopFetch", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "clientCredentialsFactory", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.clientCredentialsFactory = (0, Db.createClientCredentialsFactory)(e, n, s, i, c), this.dpopFetch = (0, jb.dpopFetchWrapper)({
      fetch: (0, gd.bindFetch)(d),
      key: r,
      supportedAlgs: n.dpop_signing_alg_values_supported,
      sha256: async (u) => i.sha256(u),
      nonces: a,
      isAuthServer: !0
    });
  }
  get issuer() {
    return this.serverMetadata.issuer;
  }
  async revoke(e) {
    try {
      await this.request("revocation", { token: e });
    } catch {
    }
  }
  async exchangeCode(e, r, n) {
    const s = Date.now(), a = await this.request("token", {
      grant_type: "authorization_code",
      // redirectUri should always be passed by the calling code, but if it is
      // not, default to the first redirect_uri registered for the client:
      redirect_uri: n ?? this.clientMetadata.redirect_uris[0],
      code: e,
      code_verifier: r
    });
    try {
      return {
        aud: await this.verifyIssuer(a.sub),
        sub: a.sub,
        iss: this.issuer,
        scope: a.scope,
        refresh_token: a.refresh_token,
        access_token: a.access_token,
        token_type: a.token_type,
        expires_at: typeof a.expires_in == "number" ? new Date(s + a.expires_in * 1e3).toISOString() : void 0
      };
    } catch (o) {
      throw await this.revoke(a.access_token), o;
    }
  }
  async refresh(e) {
    if (!e.refresh_token)
      throw new kb.TokenRefreshError(e.sub, "No refresh token available");
    const r = await this.verifyIssuer(e.sub), n = Date.now(), s = await this.request("token", {
      grant_type: "refresh_token",
      refresh_token: e.refresh_token
    });
    return {
      aud: r,
      sub: e.sub,
      iss: this.issuer,
      scope: s.scope,
      refresh_token: s.refresh_token,
      access_token: s.access_token,
      token_type: s.token_type,
      expires_at: typeof s.expires_in == "number" ? new Date(n + s.expires_in * 1e3).toISOString() : void 0
    };
  }
  /**
   * VERY IMPORTANT ! Always call this to process token responses.
   *
   * Whenever an OAuth token response is received, we **MUST** verify that the
   * "sub" is a DID, whose issuer authority is indeed the server we just
   * obtained credentials from. This check is a critical step to actually be
   * able to use the "sub" (DID) as being the actual user's identifier.
   *
   * @returns The user's PDS URL (the resource server for the user)
   */
  async verifyIssuer(e) {
    const r = await this.oauthResolver.resolveFromIdentity(e, {
      noCache: !0,
      allowStale: !1,
      signal: AbortSignal.timeout(1e4)
    });
    if (this.issuer !== r.metadata.issuer)
      throw new TypeError("Issuer mismatch");
    return r.pds.href;
  }
  async request(e, r) {
    const n = this.serverMetadata[`${e}_endpoint`];
    if (!n)
      throw new Error(`No ${e} endpoint available`);
    const s = await this.clientCredentialsFactory(), { response: a, json: o } = await this.dpopFetch(n, {
      method: "POST",
      headers: {
        ...s.headers,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: Mb({ ...r, ...s.payload })
    }).then((0, gd.fetchJsonProcessor)());
    if (a.ok)
      switch (e) {
        case "token":
          return _d.atprotoOAuthTokenResponseSchema.parse(o);
        case "pushed_authorization_request":
          return _d.oauthParResponseSchema.parse(o);
        default:
          return o;
      }
    else
      throw new zb.OAuthResponseError(a, o);
  }
}
gs.OAuthServerAgent = $b;
function Mb(t) {
  return new URLSearchParams(Object.entries(t).filter(Ub).map(Kb)).toString();
}
function Ub(t) {
  return t[1] !== void 0;
}
function Kb(t) {
  const e = t[0], r = t[1];
  switch (typeof r) {
    case "string":
      return [e, r];
    case "number":
    case "boolean":
      return [e, String(r)];
    default: {
      const n = JSON.stringify(r);
      if (n === void 0)
        throw new Error(`Unsupported value type for ${e}: ${String(r)}`);
      return [e, n];
    }
  }
}
Object.defineProperty(_s, "__esModule", { value: !0 });
_s.OAuthServerFactory = void 0;
const xb = Zr, Lb = gs;
class Nb {
  constructor(e, r, n, s, a, o) {
    Object.defineProperty(this, "clientMetadata", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: e
    }), Object.defineProperty(this, "runtime", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: r
    }), Object.defineProperty(this, "resolver", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: n
    }), Object.defineProperty(this, "fetch", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: s
    }), Object.defineProperty(this, "keyset", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: a
    }), Object.defineProperty(this, "dpopNonceCache", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: o
    });
  }
  /**
   * @param authMethod `undefined` means that we are restoring a session that
   * was created before we started storing the `authMethod` in the session. In
   * that case, we will use the first key from the keyset.
   *
   * Support for this might be removed in the future.
   *
   * @throws see {@link OAuthServerFactory.fromMetadata}
   */
  async fromIssuer(e, r, n, s) {
    const a = await this.resolver.getAuthorizationServerMetadata(e, s);
    return r === "legacy" && (r = (0, xb.negotiateClientAuthMethod)(a, this.clientMetadata, this.keyset)), this.fromMetadata(a, r, n);
  }
  /**
   * @throws see {@link OAuthServerAgent}
   */
  async fromMetadata(e, r, n) {
    return new Lb.OAuthServerAgent(r, n, e, this.clientMetadata, this.dpopNonceCache, this.resolver, this.runtime, this.keyset, this.fetch);
  }
}
_s.OAuthServerFactory = Nb;
var ws = {}, Vr = {};
Object.defineProperty(Vr, "__esModule", { value: !0 });
Vr.TokenInvalidError = void 0;
class Wb extends Error {
  constructor(e, r = `The session for "${e}" is invalid`, n) {
    super(r, n), Object.defineProperty(this, "sub", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: e
    });
  }
}
Vr.TokenInvalidError = Wb;
Object.defineProperty(ws, "__esModule", { value: !0 });
ws.OAuthSession = void 0;
const Hb = ut, Jb = Vr, Zb = cr, Fb = wo, wd = globalThis.ReadableStream;
class Bb {
  constructor(e, r, n, s = globalThis.fetch) {
    Object.defineProperty(this, "server", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: e
    }), Object.defineProperty(this, "sub", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: r
    }), Object.defineProperty(this, "sessionGetter", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: n
    }), Object.defineProperty(this, "dpopFetch", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.dpopFetch = (0, Fb.dpopFetchWrapper)({
      fetch: (0, Hb.bindFetch)(s),
      key: e.dpopKey,
      supportedAlgs: e.serverMetadata.dpop_signing_alg_values_supported,
      sha256: async (a) => e.runtime.sha256(a),
      nonces: e.dpopNonces,
      isAuthServer: !1
    });
  }
  get did() {
    return this.sub;
  }
  get serverMetadata() {
    return this.server.serverMetadata;
  }
  /**
   * @param refresh When `true`, the credentials will be refreshed even if they
   * are not expired. When `false`, the credentials will not be refreshed even
   * if they are expired. When `undefined`, the credentials will be refreshed
   * if, and only if, they are (about to be) expired. Defaults to `undefined`.
   */
  async getTokenSet(e) {
    const { tokenSet: r } = await this.sessionGetter.get(this.sub, {
      noCache: e === !0,
      allowStale: e === !1
    });
    return r;
  }
  async getTokenInfo(e = "auto") {
    const r = await this.getTokenSet(e), n = r.expires_at == null ? void 0 : new Date(r.expires_at);
    return {
      expiresAt: n,
      get expired() {
        return n == null ? void 0 : n.getTime() < Date.now() - 5e3;
      },
      scope: r.scope,
      iss: r.iss,
      aud: r.aud,
      sub: r.sub
    };
  }
  async signOut() {
    try {
      const e = await this.getTokenSet(!1);
      await this.server.revoke(e.access_token);
    } finally {
      await this.sessionGetter.delStored(this.sub, new Zb.TokenRevokedError(this.sub));
    }
  }
  async fetchHandler(e, r) {
    const n = await this.getTokenSet("auto"), s = new URL(e, n.aud), a = `${n.token_type} ${n.access_token}`, o = new Headers(r == null ? void 0 : r.headers);
    o.set("Authorization", a);
    const i = await this.dpopFetch(s, {
      ...r,
      headers: o
    });
    if (!vd(i))
      return i;
    let c;
    try {
      c = await this.getTokenSet(!0);
    } catch {
      return i;
    }
    if (wd && (r == null ? void 0 : r.body) instanceof wd)
      return i;
    const d = `${c.token_type} ${c.access_token}`, u = new URL(e, c.aud);
    o.set("Authorization", d);
    const l = await this.dpopFetch(u, { ...r, headers: o });
    return vd(l) && await this.sessionGetter.delStored(this.sub, new Jb.TokenInvalidError(this.sub)), l;
  }
}
ws.OAuthSession = Bb;
function vd(t) {
  if (t.status !== 401)
    return !1;
  const e = t.headers.get("WWW-Authenticate");
  return e != null && (e.startsWith("Bearer ") || e.startsWith("DPoP ")) && e.includes('error="invalid_token"');
}
var vo = {};
Object.defineProperty(vo, "__esModule", { value: !0 });
vo.Runtime = void 0;
const oi = Wi, Vb = us;
class qb {
  constructor(e) {
    Object.defineProperty(this, "implementation", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: e
    }), Object.defineProperty(this, "hasImplementationLock", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "usingLock", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    });
    const { requestLock: r } = e;
    this.hasImplementationLock = r != null, this.usingLock = (r == null ? void 0 : r.bind(e)) || // Falling back to a local lock
    Vb.requestLocalLock;
  }
  async generateKey(e) {
    const r = Array.from(e).sort(Yb);
    return this.implementation.createKey(r);
  }
  async sha256(e) {
    const r = new TextEncoder().encode(e), n = await this.implementation.digest(r, { name: "sha256" });
    return oi.base64url.baseEncode(n);
  }
  async generateNonce(e = 16) {
    const r = await this.implementation.getRandomValues(e);
    return oi.base64url.baseEncode(r);
  }
  async generatePKCE(e) {
    const r = await this.generateVerifier(e);
    return {
      verifier: r,
      challenge: await this.sha256(r),
      method: "S256"
    };
  }
  async calculateJwkThumbprint(e) {
    const r = Gb(e), n = JSON.stringify(r);
    return this.sha256(n);
  }
  /**
   * @see {@link https://datatracker.ietf.org/doc/html/rfc7636#section-4.1}
   * @note It is RECOMMENDED that the output of a suitable random number generator
   * be used to create a 32-octet sequence. The octet sequence is then
   * base64url-encoded to produce a 43-octet URL safe string to use as the code
   * verifier.
   */
  async generateVerifier(e = 32) {
    if (e < 32 || e > 96)
      throw new TypeError("Invalid code_verifier length");
    const r = await this.implementation.getRandomValues(e);
    return oi.base64url.baseEncode(r);
  }
}
vo.Runtime = qb;
function Gb(t) {
  const e = (r) => {
    const n = t[r];
    if (typeof n != "string" || !n)
      throw new TypeError(`"${r}" Parameter missing or invalid`);
    return n;
  };
  switch (t.kty) {
    case "EC":
      return { crv: e("crv"), kty: e("kty"), x: e("x"), y: e("y") };
    case "OKP":
      return { crv: e("crv"), kty: e("kty"), x: e("x") };
    case "RSA":
      return { e: e("e"), kty: e("kty"), n: e("n") };
    case "oct":
      return { k: e("k"), kty: e("kty") };
    default:
      throw new TypeError('"kty" (Key Type) Parameter missing or unsupported');
  }
}
function Yb(t, e) {
  if (t === "ES256K")
    return -1;
  if (e === "ES256K")
    return 1;
  for (const r of ["ES", "PS", "RS"])
    if (t.startsWith(r)) {
      if (e.startsWith(r)) {
        const n = parseInt(t.slice(2, 5)), s = parseInt(e.slice(2, 5));
        return n - s;
      }
      return -1;
    } else if (e.startsWith(r))
      return 1;
  return 0;
}
var vs = {}, Xb = v && v.__addDisposableResource || function(t, e, r) {
  if (e != null) {
    if (typeof e != "object" && typeof e != "function") throw new TypeError("Object expected.");
    var n, s;
    if (r) {
      if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
      n = e[Symbol.asyncDispose];
    }
    if (n === void 0) {
      if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
      n = e[Symbol.dispose], r && (s = n);
    }
    if (typeof n != "function") throw new TypeError("Object not disposable.");
    s && (n = function() {
      try {
        s.call(this);
      } catch (a) {
        return Promise.reject(a);
      }
    }), t.stack.push({ value: e, dispose: n, async: r });
  } else r && t.stack.push({ async: !0 });
  return e;
}, Qb = v && v.__disposeResources || /* @__PURE__ */ function(t) {
  return function(e) {
    function r(o) {
      e.error = e.hasError ? new t(o, e.error, "An error was suppressed during disposal.") : o, e.hasError = !0;
    }
    var n, s = 0;
    function a() {
      for (; n = e.stack.pop(); )
        try {
          if (!n.async && s === 1) return s = 0, e.stack.push(n), Promise.resolve().then(a);
          if (n.dispose) {
            var o = n.dispose.call(n.value);
            if (n.async) return s |= 2, Promise.resolve(o).then(a, function(i) {
              return r(i), a();
            });
          } else s |= 1;
        } catch (i) {
          r(i);
        }
      if (s === 1) return e.hasError ? Promise.reject(e.error) : Promise.resolve();
      if (e.hasError) throw e.error;
    }
    return a();
  };
}(typeof SuppressedError == "function" ? SuppressedError : function(t, e, r) {
  var n = new Error(r);
  return n.name = "SuppressedError", n.error = t, n.suppressed = e, n;
});
Object.defineProperty(vs, "__esModule", { value: !0 });
vs.SessionGetter = void 0;
const eS = Rr, bd = Jr, tS = Vr, Ft = Fr, rS = cr, nS = Br, Sd = Wr;
class sS extends eS.CachedGetter {
  constructor(e, r, n) {
    super(async (s, a, o) => {
      var l;
      if (o === void 0) {
        const p = "The session was deleted by another process", f = new Ft.TokenRefreshError(s, p);
        throw this.dispatchEvent("deleted", { sub: s, cause: f }), f;
      }
      const { dpopKey: i, authMethod: c = "legacy", tokenSet: d } = o;
      if (s !== d.sub)
        throw new Ft.TokenRefreshError(s, "Stored session sub mismatch");
      if (!d.refresh_token)
        throw new Ft.TokenRefreshError(s, "No refresh token available");
      const u = await r.fromIssuer(d.iss, c, i);
      (l = a == null ? void 0 : a.signal) == null || l.throwIfAborted();
      try {
        const p = await u.refresh(d);
        if (s !== p.sub)
          throw new Ft.TokenRefreshError(s, "Token set sub mismatch");
        return {
          dpopKey: i,
          tokenSet: p,
          authMethod: u.authMethod
        };
      } catch (p) {
        if (p instanceof nS.OAuthResponseError && p.status === 400 && p.error === "invalid_grant") {
          if (!n.hasImplementationLock) {
            await new Promise((g) => setTimeout(g, 1e3));
            const _ = await this.getStored(s);
            if (_ === void 0) {
              const g = "The session was deleted by another process";
              throw new Ft.TokenRefreshError(s, g, { cause: p });
            } else if (_.tokenSet.access_token !== d.access_token || _.tokenSet.refresh_token !== d.refresh_token)
              return _;
          }
          const f = p.errorDescription ?? "The session was revoked";
          throw new Ft.TokenRefreshError(s, f, { cause: p });
        }
        throw p;
      }
    }, e, {
      isStale: (s, { tokenSet: a }) => a.expires_at != null && new Date(a.expires_at).getTime() < Date.now() + // Add some lee way to ensure the token is not expired when it
      // reaches the server.
      1e4 + // Add some randomness to reduce the chances of multiple
      // instances trying to refresh the token at the same.
      3e4 * Math.random(),
      onStoreError: async (s, a, { tokenSet: o, dpopKey: i, authMethod: c = "legacy" }) => {
        if (!(s instanceof bd.AuthMethodUnsatisfiableError))
          try {
            await (await r.fromIssuer(o.iss, c, i)).revoke(o.refresh_token ?? o.access_token);
          } catch {
          }
        throw s;
      },
      deleteOnError: async (s) => s instanceof Ft.TokenRefreshError || s instanceof rS.TokenRevokedError || s instanceof tS.TokenInvalidError || s instanceof bd.AuthMethodUnsatisfiableError
    }), Object.defineProperty(this, "runtime", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: n
    }), Object.defineProperty(this, "eventTarget", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: new Sd.CustomEventTarget()
    });
  }
  addEventListener(e, r, n) {
    this.eventTarget.addEventListener(e, r, n);
  }
  removeEventListener(e, r, n) {
    this.eventTarget.removeEventListener(e, r, n);
  }
  dispatchEvent(e, r) {
    return this.eventTarget.dispatchCustomEvent(e, r);
  }
  async setStored(e, r) {
    if (e !== r.tokenSet.sub)
      throw new TypeError("Token set does not match the expected sub");
    await super.setStored(e, r), this.dispatchEvent("updated", { sub: e, ...r });
  }
  async delStored(e, r) {
    await super.delStored(e, r), this.dispatchEvent("deleted", { sub: e, cause: r });
  }
  /**
   * @param refresh When `true`, the credentials will be refreshed even if they
   * are not expired. When `false`, the credentials will not be refreshed even
   * if they are expired. When `undefined`, the credentials will be refreshed
   * if, and only if, they are (about to be) expired. Defaults to `undefined`.
   */
  async getSession(e, r = "auto") {
    return this.get(e, {
      noCache: r === !0,
      allowStale: r === !1
    });
  }
  async get(e, r) {
    const n = await this.runtime.usingLock(`@atproto-oauth-client-${e}`, async () => {
      const s = { stack: [], error: void 0, hasError: !1 };
      try {
        const a = AbortSignal.timeout(3e4), o = Xb(s, (0, Sd.combineSignals)([r == null ? void 0 : r.signal, a]), !1);
        return await super.get(e, {
          ...r,
          signal: o.signal
        });
      } catch (a) {
        s.error = a, s.hasError = !0;
      } finally {
        Qb(s);
      }
    });
    if (e !== n.tokenSet.sub)
      throw new Error("Token set does not match the expected sub");
    return n;
  }
}
vs.SessionGetter = sS;
var gc = {}, bs = {};
Object.defineProperty(bs, "__esModule", { value: !0 });
bs.clientMetadataSchema = void 0;
const aS = R, ii = xe;
bs.clientMetadataSchema = ii.oauthClientMetadataSchema.extend({
  client_id: aS.z.union([
    ii.oauthClientIdDiscoverableSchema,
    ii.oauthClientIdLoopbackSchema
  ])
});
Object.defineProperty(gc, "__esModule", { value: !0 });
gc.validateClientMetadata = iS;
const Ed = xe, Ad = Hr, oS = bs;
function iS(t, e) {
  var o;
  !t.jwks && !t.jwks_uri && (e != null && e.size) && (t = { ...t, jwks: e.toJSON() });
  const r = oS.clientMetadataSchema.parse(t);
  r.client_id.startsWith("http:") ? (0, Ed.assertOAuthLoopbackClientId)(r.client_id) : (0, Ed.assertOAuthDiscoverableClientId)(r.client_id);
  const n = (o = r.scope) == null ? void 0 : o.split(" ");
  if (!(n != null && n.includes("atproto")))
    throw new TypeError('Client metadata must include the "atproto" scope');
  if (!r.response_types.includes("code"))
    throw new TypeError('"response_types" must include "code"');
  if (!r.grant_types.includes("authorization_code"))
    throw new TypeError('"grant_types" must include "authorization_code"');
  const s = r.token_endpoint_auth_method, a = r.token_endpoint_auth_signing_alg;
  switch (s) {
    case "none":
      if (a)
        throw new TypeError(`"token_endpoint_auth_signing_alg" must not be provided when "token_endpoint_auth_method" is "${s}"`);
      break;
    case "private_key_jwt": {
      if (!a)
        throw new TypeError(`"token_endpoint_auth_signing_alg" must be provided when "token_endpoint_auth_method" is "${s}"`);
      if (!e)
        throw new TypeError(`Client authentication method "${s}" requires a keyset`);
      const i = Array.from(e.list({ usage: "sign" })).filter((c) => c.kid);
      if (!i.length)
        throw new TypeError(`Client authentication method "${s}" requires at least one active signing key with a "kid" property`);
      if (!i.some((c) => c.algorithms.includes(Ad.FALLBACK_ALG)))
        throw new TypeError(`Client authentication method "${s}" requires at least one active "${Ad.FALLBACK_ALG}" signing key`);
      if (r.jwks) {
        for (const c of i)
          if (!r.jwks.keys.some((d) => d.kid === c.kid && !d.revoked))
            throw new TypeError(`Missing or inactive key "${c.kid}" in jwks. Make sure that every signing key of the Keyset is declared as an active key in the Metadata's JWKS.`);
      } else if (!r.jwks_uri) throw new TypeError(`Client authentication method "${s}" requires a JWKS`);
      break;
    }
    default:
      throw new TypeError(`Unsupported "token_endpoint_auth_method" value: ${s}`);
  }
  return r;
}
(function(t) {
  Object.defineProperty(t, "__esModule", { value: !0 }), t.OAuthClient = t.Keyset = t.Key = void 0;
  const e = ct;
  Object.defineProperty(t, "Key", { enumerable: !0, get: function() {
    return e.Key;
  } }), Object.defineProperty(t, "Keyset", { enumerable: !0, get: function() {
    return e.Keyset;
  } });
  const r = xe, n = Kn, s = mc, a = Tr, o = Hr, i = Jr, c = cr, d = _c, u = ls, l = hs, p = Zr, f = ys, _ = go, g = _s, S = ws, w = vo, b = vs, D = Wr, N = gc;
  class oe extends D.CustomEventTarget {
    static async fetchMetadata({ clientId: T, fetch: F = globalThis.fetch, signal: W }) {
      var B, de, me, Re, _e;
      W == null || W.throwIfAborted();
      const pe = new Request(T, {
        redirect: "error",
        signal: W
      }), Y = await F(pe);
      if (Y.status !== 200)
        throw (de = (B = Y.body) == null ? void 0 : B.cancel) == null || de.call(B), new TypeError(`Failed to fetch client metadata: ${Y.status}`);
      const X = (me = Y.headers.get("content-type")) == null ? void 0 : me.split(";")[0].trim();
      if (X !== "application/json")
        throw (_e = (Re = Y.body) == null ? void 0 : Re.cancel) == null || _e.call(Re), new TypeError(`Invalid client metadata content type: ${X}`);
      const et = await Y.json();
      return W == null || W.throwIfAborted(), r.oauthClientMetadataSchema.parse(et);
    }
    constructor(T) {
      const { stateStore: F, sessionStore: W, dpopNonceCache: pe = new a.SimpleStoreMemory({ ttl: 6e4, max: 100 }), authorizationServerMetadataCache: Y = new a.SimpleStoreMemory({
        ttl: 6e4,
        max: 100
      }), protectedResourceMetadataCache: X = new a.SimpleStoreMemory({
        ttl: 6e4,
        max: 100
      }), responseMode: et, clientMetadata: B, runtimeImplementation: de, keyset: me } = T;
      super(), Object.defineProperty(this, "clientMetadata", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0
      }), Object.defineProperty(this, "responseMode", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0
      }), Object.defineProperty(this, "keyset", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0
      }), Object.defineProperty(this, "runtime", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0
      }), Object.defineProperty(this, "fetch", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0
      }), Object.defineProperty(this, "oauthResolver", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0
      }), Object.defineProperty(this, "serverFactory", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0
      }), Object.defineProperty(this, "sessionGetter", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0
      }), Object.defineProperty(this, "stateStore", {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0
      }), this.keyset = me ? me instanceof e.Keyset ? me : new e.Keyset(me) : void 0, this.clientMetadata = (0, N.validateClientMetadata)(B, this.keyset), this.responseMode = et, this.runtime = new w.Runtime(de), this.fetch = T.fetch ?? globalThis.fetch, this.oauthResolver = new _.OAuthResolver((0, d.createIdentityResolver)(T), new f.OAuthProtectedResourceMetadataResolver(X, this.fetch, { allowHttpResource: T.allowHttp }), new u.OAuthAuthorizationServerMetadataResolver(Y, this.fetch, { allowHttpIssuer: T.allowHttp })), this.serverFactory = new g.OAuthServerFactory(this.clientMetadata, this.runtime, this.oauthResolver, this.fetch, this.keyset, pe), this.sessionGetter = new b.SessionGetter(W, this.serverFactory, this.runtime), this.stateStore = F;
      for (const Re of ["deleted", "updated"])
        this.sessionGetter.addEventListener(Re, (_e) => {
          this.dispatchCustomEvent(Re, _e.detail) || _e.preventDefault();
        });
    }
    // Exposed as public API for convenience
    get identityResolver() {
      return this.oauthResolver.identityResolver;
    }
    get jwks() {
      var T;
      return ((T = this.keyset) == null ? void 0 : T.publicJwks) ?? { keys: [] };
    }
    async authorize(T, { signal: F, ...W } = {}) {
      const pe = (W == null ? void 0 : W.redirect_uri) ?? this.clientMetadata.redirect_uris[0];
      if (!this.clientMetadata.redirect_uris.includes(pe))
        throw new TypeError("Invalid redirect_uri");
      const { identityInfo: Y, metadata: X } = await this.oauthResolver.resolve(T, {
        signal: F
      }), et = await this.runtime.generatePKCE(), B = await this.runtime.generateKey(X.dpop_signing_alg_values_supported || [o.FALLBACK_ALG]), de = (0, p.negotiateClientAuthMethod)(X, this.clientMetadata, this.keyset), me = await this.runtime.generateNonce();
      await this.stateStore.set(me, {
        iss: X.issuer,
        dpopKey: B,
        authMethod: de,
        verifier: et.verifier,
        appState: W == null ? void 0 : W.state
      });
      const Re = {
        ...W,
        client_id: this.clientMetadata.client_id,
        redirect_uri: pe,
        code_challenge: et.challenge,
        code_challenge_method: et.method,
        state: me,
        login_hint: Y ? Y.handle !== s.HANDLE_INVALID ? Y.handle : Y.did : void 0,
        response_mode: this.responseMode,
        response_type: "code",
        scope: (W == null ? void 0 : W.scope) ?? this.clientMetadata.scope
      }, _e = new URL(X.authorization_endpoint);
      if (_e.protocol !== "https:" && _e.protocol !== "http:")
        throw new TypeError(`Invalid authorization endpoint protocol: ${_e.protocol}`);
      if (X.pushed_authorization_request_endpoint) {
        const Io = await (await this.serverFactory.fromMetadata(X, de, B)).request("pushed_authorization_request", Re);
        return _e.searchParams.set("client_id", this.clientMetadata.client_id), _e.searchParams.set("request_uri", Io.request_uri), _e;
      } else {
        if (X.require_pushed_authorization_requests)
          throw new Error("Server requires pushed authorization requests (PAR) but no PAR endpoint is available");
        for (const [Io, bc] of Object.entries(Re))
          bc && _e.searchParams.set(Io, String(bc));
        if (_e.pathname.length + _e.search.length < 2048)
          return _e;
        if (!X.pushed_authorization_request_endpoint)
          throw new Error("Login URL too long");
      }
      throw new Error("Server does not support pushed authorization requests (PAR)");
    }
    /**
     * This method allows the client to proactively revoke the request_uri it
     * created through PAR.
     */
    async abortRequest(T) {
      T.searchParams.get("request_uri");
    }
    async callback(T, F = {}) {
      if (T.get("response") != null)
        throw new l.OAuthCallbackError(T, "JARM not supported");
      const pe = T.get("iss"), Y = T.get("state"), X = T.get("error"), et = T.get("code");
      if (!Y)
        throw new l.OAuthCallbackError(T, 'Missing "state" parameter');
      const B = await this.stateStore.get(Y);
      if (B)
        await this.stateStore.del(Y);
      else
        throw new l.OAuthCallbackError(T, `Unknown authorization session "${Y}"`);
      try {
        if (X != null)
          throw new l.OAuthCallbackError(T, void 0, B.appState);
        if (!et)
          throw new l.OAuthCallbackError(T, 'Missing "code" query param', B.appState);
        const de = await this.serverFactory.fromIssuer(
          B.iss,
          // Using the literal 'legacy' if the authMethod is not defined (because stateData was created through an old version of this lib)
          B.authMethod ?? "legacy",
          B.dpopKey
        );
        if (pe != null) {
          if (!de.issuer)
            throw new l.OAuthCallbackError(T, "Issuer not found in metadata", B.appState);
          if (de.issuer !== pe)
            throw new l.OAuthCallbackError(T, "Issuer mismatch", B.appState);
        } else if (de.serverMetadata.authorization_response_iss_parameter_supported)
          throw new l.OAuthCallbackError(T, "iss missing from the response", B.appState);
        const me = await de.exchangeCode(et, B.verifier, (F == null ? void 0 : F.redirect_uri) ?? de.clientMetadata.redirect_uris[0]);
        try {
          return await this.sessionGetter.setStored(me.sub, {
            dpopKey: B.dpopKey,
            authMethod: de.authMethod,
            tokenSet: me
          }), { session: this.createSession(de, me.sub), state: B.appState ?? null };
        } catch (Re) {
          throw await de.revoke(me.refresh_token || me.access_token), Re;
        }
      } catch (de) {
        throw l.OAuthCallbackError.from(de, T, B.appState);
      }
    }
    /**
     * Load a stored session. This will refresh the token only if needed (about to
     * expire) by default.
     *
     * @param refresh See {@link SessionGetter.getSession}
     */
    async restore(T, F = "auto") {
      (0, n.assertAtprotoDid)(T);
      const { dpopKey: W, authMethod: pe = "legacy", tokenSet: Y } = await this.sessionGetter.getSession(T, F);
      try {
        const X = await this.serverFactory.fromIssuer(Y.iss, pe, W, {
          noCache: F === !0,
          allowStale: F === !1
        });
        return this.createSession(X, T);
      } catch (X) {
        throw X instanceof i.AuthMethodUnsatisfiableError && await this.sessionGetter.delStored(T, X), X;
      }
    }
    async revoke(T) {
      (0, n.assertAtprotoDid)(T);
      const { dpopKey: F, authMethod: W = "legacy", tokenSet: pe } = await this.sessionGetter.get(T, {
        allowStale: !0
      });
      try {
        await (await this.serverFactory.fromIssuer(pe.iss, W, F)).revoke(pe.access_token);
      } finally {
        await this.sessionGetter.delStored(T, new c.TokenRevokedError(T));
      }
    }
    createSession(T, F) {
      return new S.OAuthSession(T, F, this.sessionGetter, this.fetch);
    }
  }
  t.OAuthClient = oe;
})(Ql);
var ch = {};
Object.defineProperty(ch, "__esModule", { value: !0 });
var dh = {};
Object.defineProperty(dh, "__esModule", { value: !0 });
(function(t) {
  var e = v && v.__createBinding || (Object.create ? function(s, a, o, i) {
    i === void 0 && (i = o);
    var c = Object.getOwnPropertyDescriptor(a, o);
    (!c || ("get" in c ? !a.__esModule : c.writable || c.configurable)) && (c = { enumerable: !0, get: function() {
      return a[o];
    } }), Object.defineProperty(s, i, c);
  } : function(s, a, o, i) {
    i === void 0 && (i = o), s[i] = a[o];
  }), r = v && v.__exportStar || function(s, a) {
    for (var o in s) o !== "default" && !Object.prototype.hasOwnProperty.call(a, o) && e(a, s, o);
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), t.FetchResponseError = t.FetchRequestError = t.FetchError = void 0, r(Kn, t);
  var n = ut;
  Object.defineProperty(t, "FetchError", { enumerable: !0, get: function() {
    return n.FetchError;
  } }), Object.defineProperty(t, "FetchRequestError", { enumerable: !0, get: function() {
    return n.FetchRequestError;
  } }), Object.defineProperty(t, "FetchResponseError", { enumerable: !0, get: function() {
    return n.FetchResponseError;
  } }), r(pc, t), r(Lt, t), r(ct, t), r(xe, t), r(us, t), r(ls, t), r(hs, t), r(Ql, t), r(ys, t), r(ms, t), r(Br, t), r(gs, t), r(_s, t), r(ws, t), r(ch, t), r(vs, t), r(dh, t), r(bs, t), r(Vr, t), r(Fr, t), r(cr, t);
})(oc);
var bo = {}, So = {}, uh = {}, Eo = {}, Ss = {}, Es = {}, As = {}, Ps = {};
Object.defineProperty(Ps, "__esModule", { value: !0 });
Ps.handleRequest = lh;
Ps.promisify = cS;
function lh(t, e, r) {
  const n = () => {
    t.removeEventListener("success", s), t.removeEventListener("error", a);
  }, s = () => {
    e(t.result), n();
  }, a = () => {
    r(t.error || new Error("Unknown error")), n();
  };
  t.addEventListener("success", s), t.addEventListener("error", a);
}
function cS(t) {
  return new Promise((e, r) => {
    lh(t, e, r);
  });
}
Object.defineProperty(As, "__esModule", { value: !0 });
As.DBIndex = void 0;
const nn = Ps;
class dS {
  constructor(e) {
    Object.defineProperty(this, "idbIndex", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: e
    });
  }
  count(e) {
    return (0, nn.promisify)(this.idbIndex.count(e));
  }
  get(e) {
    return (0, nn.promisify)(this.idbIndex.get(e));
  }
  getKey(e) {
    return (0, nn.promisify)(this.idbIndex.getKey(e));
  }
  getAll(e, r) {
    return (0, nn.promisify)(this.idbIndex.getAll(e, r));
  }
  getAllKeys(e, r) {
    return (0, nn.promisify)(this.idbIndex.getAllKeys(e, r));
  }
  deleteAll(e) {
    return new Promise((r, n) => {
      const s = this.idbIndex.openCursor(e);
      s.onsuccess = function(a) {
        const o = a.target.result;
        o ? (o.delete(), o.continue()) : r();
      }, s.onerror = function(a) {
        var o;
        n(((o = a.target) == null ? void 0 : o.error) || new Error("Unexpected error"));
      };
    });
  }
}
As.DBIndex = dS;
Object.defineProperty(Es, "__esModule", { value: !0 });
Es.DBObjectStore = void 0;
const uS = As, St = Ps;
class lS {
  constructor(e) {
    Object.defineProperty(this, "idbObjStore", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: e
    });
  }
  get name() {
    return this.idbObjStore.name;
  }
  index(e) {
    return new uS.DBIndex(this.idbObjStore.index(e));
  }
  get(e) {
    return (0, St.promisify)(this.idbObjStore.get(e));
  }
  getKey(e) {
    return (0, St.promisify)(this.idbObjStore.getKey(e));
  }
  getAll(e, r) {
    return (0, St.promisify)(this.idbObjStore.getAll(e, r));
  }
  getAllKeys(e, r) {
    return (0, St.promisify)(this.idbObjStore.getAllKeys(e, r));
  }
  add(e, r) {
    return (0, St.promisify)(this.idbObjStore.add(e, r));
  }
  put(e, r) {
    return (0, St.promisify)(this.idbObjStore.put(e, r));
  }
  delete(e) {
    return (0, St.promisify)(this.idbObjStore.delete(e));
  }
  clear() {
    return (0, St.promisify)(this.idbObjStore.clear());
  }
}
Es.DBObjectStore = lS;
var Js = v && v.__classPrivateFieldSet || function(t, e, r, n, s) {
  if (n === "m") throw new TypeError("Private method is not writable");
  if (n === "a" && !s) throw new TypeError("Private accessor was defined without a setter");
  if (typeof e == "function" ? t !== e || !s : !e.has(t)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return n === "a" ? s.call(t, r) : s ? s.value = r : e.set(t, r), r;
}, ci = v && v.__classPrivateFieldGet || function(t, e, r, n) {
  if (r === "a" && !n) throw new TypeError("Private accessor was defined without a getter");
  if (typeof e == "function" ? t !== e || !n : !e.has(t)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return r === "m" ? n : r === "a" ? n.call(t) : n ? n.value : e.get(t);
}, lt;
Object.defineProperty(Ss, "__esModule", { value: !0 });
Ss.DBTransaction = void 0;
const hS = Es;
class fS {
  constructor(e) {
    lt.set(this, void 0), Js(this, lt, e, "f");
    const r = () => {
      s();
    }, n = () => {
      s();
    }, s = () => {
      Js(this, lt, null, "f"), e.removeEventListener("abort", r), e.removeEventListener("complete", n);
    };
    e.addEventListener("abort", r), e.addEventListener("complete", n);
  }
  get tx() {
    if (!ci(this, lt, "f"))
      throw new Error("Transaction already ended");
    return ci(this, lt, "f");
  }
  async abort() {
    const { tx: e } = this;
    Js(this, lt, null, "f"), e.abort();
  }
  async commit() {
    var r;
    const { tx: e } = this;
    Js(this, lt, null, "f"), (r = e.commit) == null || r.call(e);
  }
  objectStore(e) {
    const r = this.tx.objectStore(e);
    return new hS.DBObjectStore(r);
  }
  [(lt = /* @__PURE__ */ new WeakMap(), Symbol.dispose)]() {
    ci(this, lt, "f") && this.commit();
  }
}
Ss.DBTransaction = fS;
var di = v && v.__classPrivateFieldSet || function(t, e, r, n, s) {
  if (n === "m") throw new TypeError("Private method is not writable");
  if (n === "a" && !s) throw new TypeError("Private accessor was defined without a setter");
  if (typeof e == "function" ? t !== e || !s : !e.has(t)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return n === "a" ? s.call(t, r) : s ? s.value = r : e.set(t, r), r;
}, ui = v && v.__classPrivateFieldGet || function(t, e, r, n) {
  if (r === "a" && !n) throw new TypeError("Private accessor was defined without a getter");
  if (typeof e == "function" ? t !== e || !n : !e.has(t)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return r === "m" ? n : r === "a" ? n.call(t) : n ? n.value : e.get(t);
}, Et;
Object.defineProperty(Eo, "__esModule", { value: !0 });
Eo.DB = void 0;
const pS = Ss;
class wc {
  static async open(e, r, n) {
    const s = await new Promise((a, o) => {
      const i = indexedDB.open(e, r.length);
      i.onerror = () => o(i.error), i.onsuccess = () => a(i.result), i.onupgradeneeded = ({ oldVersion: c, newVersion: d }) => {
        const u = i.result;
        try {
          for (let l = c; l < (d ?? r.length); ++l) {
            const p = r[l];
            if (p)
              p(u);
            else
              throw new Error(`Missing migration for version ${l}`);
          }
        } catch (l) {
          u.close(), o(l);
        }
      };
    });
    return new wc(s, n);
  }
  constructor(e, r) {
    Object.defineProperty(this, "txOptions", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: r
    }), Et.set(this, void 0), di(this, Et, e, "f");
    const n = () => {
      di(this, Et, null, "f"), e.removeEventListener("versionchange", n), e.removeEventListener("close", n), e.close();
    };
    e.addEventListener("versionchange", n), e.addEventListener("close", n);
  }
  get db() {
    if (!ui(this, Et, "f"))
      throw new Error("Database closed");
    return ui(this, Et, "f");
  }
  get name() {
    return this.db.name;
  }
  get objectStoreNames() {
    return this.db.objectStoreNames;
  }
  get version() {
    return this.db.version;
  }
  async transaction(e, r, n) {
    return new Promise(async (s, a) => {
      try {
        const o = this.db.transaction(e, r, this.txOptions);
        let i = { done: !1 };
        o.oncomplete = () => {
          i.done ? s(i.value) : a(new Error("Transaction completed without result"));
        }, o.onerror = () => a(o.error), o.onabort = () => a(o.error || new Error("Transaction aborted"));
        try {
          i = { done: !0, value: await n(new pS.DBTransaction(o)) }, o.commit();
        } catch (c) {
          throw o.abort(), c;
        }
      } catch (o) {
        a(o);
      }
    });
  }
  close() {
    const { db: e } = this;
    di(this, Et, null, "f"), e.close();
  }
  [(Et = /* @__PURE__ */ new WeakMap(), Symbol.dispose)]() {
    if (ui(this, Et, "f"))
      return this.close();
  }
}
Eo.DB = wc;
(function(t) {
  var e = v && v.__createBinding || (Object.create ? function(n, s, a, o) {
    o === void 0 && (o = a);
    var i = Object.getOwnPropertyDescriptor(s, a);
    (!i || ("get" in i ? !s.__esModule : i.writable || i.configurable)) && (i = { enumerable: !0, get: function() {
      return s[a];
    } }), Object.defineProperty(n, o, i);
  } : function(n, s, a, o) {
    o === void 0 && (o = a), n[o] = s[a];
  }), r = v && v.__exportStar || function(n, s) {
    for (var a in n) a !== "default" && !Object.prototype.hasOwnProperty.call(s, a) && e(s, n, a);
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), r(Eo, t), r(As, t), r(Es, t), r(Ss, t);
})(uh);
var Zs = v && v.__classPrivateFieldSet || function(t, e, r, n, s) {
  if (n === "m") throw new TypeError("Private method is not writable");
  if (n === "a" && !s) throw new TypeError("Private accessor was defined without a setter");
  if (typeof e == "function" ? t !== e || !s : !e.has(t)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return n === "a" ? s.call(t, r) : s ? s.value = r : e.set(t, r), r;
}, sn = v && v.__classPrivateFieldGet || function(t, e, r, n) {
  if (r === "a" && !n) throw new TypeError("Private accessor was defined without a getter");
  if (typeof e == "function" ? t !== e || !n : !e.has(t)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return r === "m" ? n : r === "a" ? n.call(t) : n ? n.value : e.get(t);
}, At, an;
Object.defineProperty(So, "__esModule", { value: !0 });
So.BrowserOAuthDatabase = void 0;
const hh = Aa, yS = uh;
function Pd(t) {
  if (!(t instanceof hh.WebcryptoKey) || !t.kid)
    throw new Error("Invalid key object");
  return {
    keyId: t.kid,
    keyPair: t.cryptoKeyPair
  };
}
async function Id(t) {
  return hh.WebcryptoKey.fromKeypair(t.keyPair, t.keyId);
}
const Cd = [
  "state",
  "session",
  "didCache",
  "dpopNonceCache",
  "handleCache",
  "authorizationServerMetadataCache",
  "protectedResourceMetadataCache"
];
class mS {
  constructor(e) {
    At.set(this, void 0), an.set(this, void 0), Zs(this, At, yS.DB.open((e == null ? void 0 : e.name) ?? "@atproto-oauth-client", [
      (r) => {
        for (const n of Cd)
          r.createObjectStore(n, { autoIncrement: !0 }).createIndex("expiresAt", "expiresAt", { unique: !1 });
      }
    ], { durability: (e == null ? void 0 : e.durability) ?? "strict" }), "f"), Zs(this, an, setInterval(() => {
      this.cleanup();
    }, (e == null ? void 0 : e.cleanupInterval) ?? 3e4), "f");
  }
  async run(e, r, n) {
    return await (await sn(this, At, "f")).transaction([e], r, (a) => n(a.objectStore(e)));
  }
  createStore(e, { encode: r, decode: n, expiresAt: s }) {
    return {
      get: async (a) => {
        const o = await this.run(e, "readonly", (i) => i.get(a));
        if (o !== void 0) {
          if (o.expiresAt != null && new Date(o.expiresAt) < /* @__PURE__ */ new Date()) {
            await this.run(e, "readwrite", (i) => i.delete(a));
            return;
          }
          return n(o.value);
        }
      },
      set: async (a, o) => {
        var c;
        const i = {
          value: await r(o),
          expiresAt: (c = s(o)) == null ? void 0 : c.toISOString()
        };
        await this.run(e, "readwrite", (d) => d.put(i, a));
      },
      del: async (a) => {
        await this.run(e, "readwrite", (o) => o.delete(a));
      }
    };
  }
  getSessionStore() {
    return this.createStore("session", {
      expiresAt: ({ tokenSet: e }) => e.refresh_token || e.expires_at == null ? null : new Date(e.expires_at),
      encode: ({ dpopKey: e, ...r }) => ({
        ...r,
        dpopKey: Pd(e)
      }),
      decode: async ({ dpopKey: e, ...r }) => ({
        ...r,
        dpopKey: await Id(e)
      })
    });
  }
  getStateStore() {
    return this.createStore("state", {
      expiresAt: (e) => new Date(Date.now() + 10 * 6e4),
      encode: ({ dpopKey: e, ...r }) => ({
        ...r,
        dpopKey: Pd(e)
      }),
      decode: async ({ dpopKey: e, ...r }) => ({
        ...r,
        dpopKey: await Id(e)
      })
    });
  }
  getDpopNonceCache() {
    return this.createStore("dpopNonceCache", {
      expiresAt: (e) => new Date(Date.now() + 6e5),
      encode: (e) => e,
      decode: (e) => e
    });
  }
  getDidCache() {
    return this.createStore("didCache", {
      expiresAt: (e) => new Date(Date.now() + 6e4),
      encode: (e) => e,
      decode: (e) => e
    });
  }
  getHandleCache() {
    return this.createStore("handleCache", {
      expiresAt: (e) => new Date(Date.now() + 6e4),
      encode: (e) => e,
      decode: (e) => e
    });
  }
  getAuthorizationServerMetadataCache() {
    return this.createStore("authorizationServerMetadataCache", {
      expiresAt: (e) => new Date(Date.now() + 6e4),
      encode: (e) => e,
      decode: (e) => e
    });
  }
  getProtectedResourceMetadataCache() {
    return this.createStore("protectedResourceMetadataCache", {
      expiresAt: (e) => new Date(Date.now() + 6e4),
      encode: (e) => e,
      decode: (e) => e
    });
  }
  async cleanup() {
    const e = await sn(this, At, "f");
    for (const r of Cd)
      await e.transaction([r], "readwrite", (n) => n.objectStore(r).index("expiresAt").deleteAll(IDBKeyRange.upperBound(Date.now())));
  }
  async [(At = /* @__PURE__ */ new WeakMap(), an = /* @__PURE__ */ new WeakMap(), Symbol.asyncDispose)]() {
    clearInterval(sn(this, an, "f")), Zs(this, an, void 0, "f");
    const e = sn(this, At, "f");
    Zs(this, At, Promise.reject(new Error("Database has been disposed")), "f"), sn(this, At, "f").catch(() => null);
    const r = await e.catch(() => null);
    r && await (r[Symbol.asyncDispose] || r[Symbol.dispose]).call(r);
  }
}
So.BrowserOAuthDatabase = mS;
var Ao = {};
Object.defineProperty(Ao, "__esModule", { value: !0 });
Ao.BrowserRuntimeImplementation = void 0;
const _S = Aa;
var Ud;
const gS = typeof navigator < "u" && ((Ud = navigator.locks) != null && Ud.request) ? (t, e) => navigator.locks.request(t, { mode: "exclusive" }, async () => e()) : void 0;
class wS {
  constructor() {
    if (Object.defineProperty(this, "requestLock", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: gS
    }), typeof crypto != "object" || !(crypto != null && crypto.subtle))
      throw new Error("Crypto with CryptoSubtle is required. If running in a browser, make sure the current page is loaded over HTTPS.");
    this.requestLock || console.warn("Locks API not available. You should consider using a more recent browser.");
  }
  async createKey(e) {
    return _S.WebcryptoKey.generate(e);
  }
  getRandomValues(e) {
    return crypto.getRandomValues(new Uint8Array(e));
  }
  async digest(e, { name: r }) {
    switch (r) {
      case "sha256":
      case "sha384":
      case "sha512": {
        const n = await crypto.subtle.digest(`SHA-${r.slice(3)}`, e);
        return new Uint8Array(n);
      }
      default:
        throw new Error(`Unsupported digest algorithm: ${r}`);
    }
  }
}
Ao.BrowserRuntimeImplementation = wS;
var Is = {};
Object.defineProperty(Is, "__esModule", { value: !0 });
Is.LoginContinuedInParentWindowError = void 0;
class vS extends Error {
  constructor() {
    super("Login complete, please close the popup window."), Object.defineProperty(this, "code", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "LOGIN_CONTINUED_IN_PARENT_WINDOW"
    });
  }
}
Is.LoginContinuedInParentWindowError = vS;
var Po = {};
Object.defineProperty(Po, "__esModule", { value: !0 });
Po.buildLoopbackClientId = SS;
const bS = xe;
function SS(t, e = "127.0.0.1") {
  if (!(0, bS.isLoopbackHost)(t.hostname))
    throw new TypeError(`Expected a loopback host, got ${t.hostname}`);
  const r = `http://${t.hostname === "localhost" ? e : t.hostname}${t.port && !t.port.startsWith(":") ? `:${t.port}` : t.port}${t.pathname}`;
  return `http://localhost${t.pathname === "/" ? "" : t.pathname}?redirect_uri=${encodeURIComponent(r)}`;
}
var fh;
Object.defineProperty(bo, "__esModule", { value: !0 });
bo.BrowserOAuthClient = void 0;
const Fs = oc, ta = xe, ES = So, AS = Ao, li = Is, PS = Po, tt = "@@atproto/oauth-client-browser", Od = `${tt}(popup-channel)`, on = `${tt}(popup-state):`, Td = new BroadcastChannel(`${tt}(synchronization-channel)`);
class va extends Fs.OAuthClient {
  static async load({ clientId: e, ...r }) {
    if (e.startsWith("http:")) {
      const n = (0, ta.atprotoLoopbackClientMetadata)(e);
      return new va({ clientMetadata: n, ...r });
    } else if (e.startsWith("https:")) {
      (0, ta.assertOAuthDiscoverableClientId)(e);
      const n = await Fs.OAuthClient.fetchMetadata({
        clientId: e,
        ...r
      });
      return new va({ ...r, clientMetadata: n });
    } else
      throw new TypeError(`Invalid client id: ${e}`);
  }
  constructor({
    clientMetadata: e = (0, ta.atprotoLoopbackClientMetadata)((0, PS.buildLoopbackClientId)(window.location)),
    // "fragment" is a safer default as the query params will not be sent to the server
    responseMode: r = "fragment",
    ...n
  }) {
    var i;
    if (!((i = globalThis.crypto) != null && i.subtle))
      throw new Error("WebCrypto API is required");
    if (!["query", "fragment"].includes(r))
      throw new TypeError(`Invalid response mode: ${r}`);
    const s = new ES.BrowserOAuthDatabase();
    super({
      ...n,
      clientMetadata: e,
      responseMode: r,
      keyset: void 0,
      runtimeImplementation: new AS.BrowserRuntimeImplementation(),
      sessionStore: s.getSessionStore(),
      stateStore: s.getStateStore(),
      didCache: s.getDidCache(),
      handleCache: s.getHandleCache(),
      dpopNonceCache: s.getDpopNonceCache(),
      authorizationServerMetadataCache: s.getAuthorizationServerMetadataCache(),
      protectedResourceMetadataCache: s.getProtectedResourceMetadataCache()
    }), Object.defineProperty(this, fh, {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    });
    const a = new AbortController(), { signal: o } = a;
    this[Symbol.dispose] = () => a.abort(), o.addEventListener("abort", () => s[Symbol.asyncDispose](), {
      once: !0
    }), this.addEventListener("deleted", ({ detail: { sub: c } }) => {
      localStorage.getItem(`${tt}(sub)`) === c && localStorage.removeItem(`${tt}(sub)`);
    });
    for (const c of ["deleted", "updated"])
      this.sessionGetter.addEventListener(c, ({ detail: d }) => {
        Td.postMessage([c, d]);
      });
    Td.addEventListener(
      "message",
      (c) => {
        if (c.source !== window) {
          const [d, u] = c.data;
          this.dispatchCustomEvent(d, u);
        }
      },
      // Remove the listener when the client is disposed
      { signal: o }
    );
  }
  /**
   * This method will automatically restore any existing session, or attempt to
   * process login callback if the URL contains oauth parameters.
   *
   * Use {@link BrowserOAuthClient.initCallback} instead of this method if you
   * want to force a login callback. This can be esp. useful if you are using
   * this lib from a framework that has some kind of URL manipulation (like a
   * client side router).
   *
   * Use {@link BrowserOAuthClient.initRestore} instead of this method if you
   * want to only restore existing sessions, and bypass the automatic processing
   * of login callbacks.
   */
  async init(e) {
    const r = this.readCallbackParams();
    if (r) {
      const n = this.findRedirectUrl();
      if (n)
        return this.initCallback(r, n);
    }
    return this.initRestore(e);
  }
  async initRestore(e) {
    await IS(this.clientMetadata);
    const r = localStorage.getItem(`${tt}(sub)`);
    if (r)
      try {
        return { session: await this.restore(r, e) };
      } catch (n) {
        throw localStorage.removeItem(`${tt}(sub)`), n;
      }
  }
  async restore(e, r) {
    const n = await super.restore(e, r);
    return localStorage.setItem(`${tt}(sub)`, n.sub), n;
  }
  async revoke(e) {
    return localStorage.removeItem(`${tt}(sub)`), super.revoke(e);
  }
  async signIn(e, r) {
    return (r == null ? void 0 : r.display) === "popup" ? this.signInPopup(e, r) : this.signInRedirect(e, r);
  }
  async signInRedirect(e, r) {
    const n = await this.authorize(e, r);
    return window.location.href = n.href, new Promise((s, a) => {
      setTimeout((o) => {
        this.abortRequest(n).then(() => a(o), (i) => a(new AggregateError([o, i])));
      }, 5e3, new Error("User navigated back"));
    });
  }
  async signInPopup(e, r) {
    var i;
    const n = "width=600,height=600,menubar=no,toolbar=no";
    let s = window.open("about:blank", "_blank", n);
    const a = `${Math.random().toString(36).slice(2)}`, o = await this.authorize(e, {
      ...r,
      state: `${on}${a}`,
      display: (r == null ? void 0 : r.display) ?? "popup"
    });
    return (i = r == null ? void 0 : r.signal) == null || i.throwIfAborted(), s ? s.window.location.href = o.href : s = window.open(o.href, "_blank", n), s == null || s.focus(), new Promise((c, d) => {
      var g;
      const u = new BroadcastChannel(Od), l = () => {
        var S;
        clearTimeout(f), u.removeEventListener("message", _), u.close(), (S = r == null ? void 0 : r.signal) == null || S.removeEventListener("abort", p), s == null || s.close();
      }, p = () => {
        var S;
        d(new Error((S = r == null ? void 0 : r.signal) != null && S.aborted ? "Aborted" : "Timeout")), l();
      };
      (g = r == null ? void 0 : r.signal) == null || g.addEventListener("abort", p);
      const f = setTimeout(p, 5 * 6e4), _ = async ({ data: S }) => {
        var b;
        if (S.key !== a || !("result" in S))
          return;
        u.postMessage({ key: a, ack: !0 }), l();
        const { result: w } = S;
        if (w.status === "fulfilled") {
          const D = w.value;
          try {
            (b = r == null ? void 0 : r.signal) == null || b.throwIfAborted(), c(await this.restore(D, !1));
          } catch (N) {
            d(N), this.revoke(D);
          }
        } else {
          const { message: D, params: N } = w.reason;
          d(new Fs.OAuthCallbackError(new URLSearchParams(N), D));
        }
      };
      u.addEventListener("message", _);
    });
  }
  findRedirectUrl() {
    for (const e of this.clientMetadata.redirect_uris) {
      const r = new URL(e);
      if (location.origin === r.origin && location.pathname === r.pathname)
        return e;
    }
  }
  readCallbackParams() {
    const e = this.responseMode === "fragment" ? new URLSearchParams(location.hash.slice(1)) : new URLSearchParams(location.search);
    return !e.has("state") || !(e.has("code") || e.has("error")) ? null : e;
  }
  async initCallback(e = this.readCallbackParams(), r = this.findRedirectUrl()) {
    if (!e)
      throw new TypeError("No OAuth callback parameters found in the URL");
    this.responseMode === "fragment" ? history.replaceState(null, "", location.pathname + location.search) : this.responseMode === "query" && history.replaceState(null, "", location.pathname);
    const n = (s) => {
      const a = new BroadcastChannel(Od);
      return new Promise((o) => {
        const i = (u) => {
          clearTimeout(d), a.removeEventListener("message", c), a.close(), o(u);
        }, c = ({ data: u }) => {
          "ack" in u && s.key === u.key && i(!0);
        };
        a.addEventListener("message", c), a.postMessage(s);
        const d = setTimeout(i, 500, !1);
      });
    };
    return this.callback(e, { redirect_uri: r }).then(async (s) => {
      var a;
      if ((a = s.state) != null && a.startsWith(on))
        throw await n({
          key: s.state.slice(on.length),
          result: {
            status: "fulfilled",
            value: s.session.sub
          }
        }) || await s.session.signOut(), new li.LoginContinuedInParentWindowError();
      return localStorage.setItem(`${tt}(sub)`, s.session.sub), s;
    }).catch(async (s) => {
      var a;
      throw s instanceof Fs.OAuthCallbackError && ((a = s.state) != null && a.startsWith(on)) ? (await n({
        key: s.state.slice(on.length),
        result: {
          status: "rejected",
          reason: {
            message: s.message,
            params: Array.from(s.params.entries())
          }
        }
      }), new li.LoginContinuedInParentWindowError()) : s;
    }).catch((s) => {
      throw s instanceof li.LoginContinuedInParentWindowError && window.close(), s;
    });
  }
  dispose() {
    this[Symbol.dispose]();
  }
}
bo.BrowserOAuthClient = va;
fh = Symbol.dispose;
function IS(t) {
  if (!(0, ta.isOAuthClientIdLoopback)(t.client_id) || window.location.hostname !== "localhost")
    return;
  const e = new URL(window.location.href);
  for (const r of t.redirect_uris) {
    const n = new URL(r);
    if ((n.hostname === "127.0.0.1" || n.hostname === "[::1]") && (!n.port || n.port === e.port) && n.protocol === e.protocol && n.pathname === e.pathname)
      throw n.port = e.port, window.location.href = n.href, new Error("Redirecting to loopback IP...");
  }
  throw new Error(`Please use the loopback IP address instead of ${e}`);
}
(function(t) {
  var e = v && v.__createBinding || (Object.create ? function(s, a, o, i) {
    i === void 0 && (i = o);
    var c = Object.getOwnPropertyDescriptor(a, o);
    (!c || ("get" in c ? !a.__esModule : c.writable || c.configurable)) && (c = { enumerable: !0, get: function() {
      return a[o];
    } }), Object.defineProperty(s, i, c);
  } : function(s, a, o, i) {
    i === void 0 && (i = o), s[i] = a[o];
  }), r = v && v.__exportStar || function(s, a) {
    for (var o in s) o !== "default" && !Object.prototype.hasOwnProperty.call(a, o) && e(a, s, o);
  };
  Object.defineProperty(t, "__esModule", { value: !0 }), t.buildLoopbackClientId = void 0, r(Aa, t), r(oc, t), r(bo, t), r(Is, t);
  var n = Po;
  Object.defineProperty(t, "buildLoopbackClientId", { enumerable: !0, get: function() {
    return n.buildLoopbackClientId;
  } });
})(xd);
class CS {
  constructor() {
    this.client = null, this.currentSession = null, this.initPromise = null;
  }
  async init() {
    return this.initPromise ? this.initPromise : (this.initPromise = (async () => {
      var e, r;
      try {
        this.client = new xd.BrowserOAuthClient({
          clientMetadata: {
            client_id: "https://reverie.house/client-metadata.json",
            client_name: "Reverie House",
            client_uri: "https://reverie.house",
            logo_uri: "https://reverie.house/assets/icon.png",
            redirect_uris: ["https://reverie.house/oauth/callback"],
            scope: "atproto transition:generic",
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            application_type: "web",
            token_endpoint_auth_method: "none",
            dpop_bound_access_tokens: !0
          },
          handleResolver: "https://bsky.social"
        }), console.log("✅ OAuth client created");
        const n = await this.client.init();
        if (n) {
          const { session: s, state: a } = n;
          this.currentSession = s, a != null ? (console.log(`✅ ${s.sub} authenticated (state: ${a})`), await this.loadProfile(s), await this.autoRegister(s.sub), window.dispatchEvent(new CustomEvent("oauth:profile-loaded", {
            detail: { session: this.currentSession }
          })), window.dispatchEvent(new CustomEvent("oauth:login", {
            detail: { session: this.currentSession }
          })), localStorage.getItem("mainDoorLogin") === "true" && (localStorage.removeItem("mainDoorLogin"), console.log("🚪 Main Door login complete"))) : (console.log(`✅ ${s.sub} restored (previous session)`), await this.loadProfile(s), await this.autoRegister(s.sub), window.dispatchEvent(new CustomEvent("oauth:profile-loaded", {
            detail: { session: this.currentSession }
          })));
        } else {
          const s = localStorage.getItem("pds_session");
          if (s)
            try {
              const a = JSON.parse(s);
              (a.did || a.sub) && (console.log(`✅ ${a.handle} restored (PDS session)`), this.currentSession = a, await this.autoRegister(a.did || a.sub), window.dispatchEvent(new CustomEvent("oauth:profile-loaded", {
                detail: { session: this.currentSession }
              })));
            } catch (a) {
              console.error("❌ Failed to restore PDS session:", a);
            }
        }
        this.client.addEventListener("deleted", (s) => {
          var i;
          const { sub: a, cause: o } = s.detail;
          console.error(`❌ Session for ${a} deleted (cause: ${o})`), ((i = this.currentSession) == null ? void 0 : i.sub) === a && (this.currentSession = null, window.dispatchEvent(new CustomEvent("oauth:logout", {
            detail: { sub: a, cause: o }
          })));
        }), console.log("✅ OAuth manager initialized");
      } catch (n) {
        throw ((e = n.message) == null ? void 0 : e.includes("rejected")) || ((r = n.message) == null ? void 0 : r.includes("cancelled")) || console.error("❌ OAuth init error:", n), n;
      }
    })(), this.initPromise);
  }
  async loadProfile(e) {
    console.log("🔍 loadProfile: Fetching public profile for", e.sub);
    try {
      let r;
      if (e.sub.includes("reverie.house") || await this.checkIfReverieAccount(e.sub)) {
        console.log("   🏠 Reverie.house account detected - fetching from local database");
        const s = await fetch("/api/dreamers");
        if (s.ok) {
          const o = (await s.json()).find((i) => i.did === e.sub);
          o && (r = {
            handle: o.handle,
            displayName: o.display_name || o.name,
            description: o.description,
            avatar: o.avatar,
            banner: o.banner,
            followersCount: o.followers_count,
            followsCount: o.follows_count,
            postsCount: o.posts_count,
            createdAt: o.created_at
          }, console.log("   ✅ Profile loaded from database:", r));
        }
      }
      if (!r) {
        const s = `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${e.sub}`;
        console.log("   Fetching from public API:", s);
        const a = await fetch(s);
        if (console.log("   Response status:", a.status), !a.ok)
          throw new Error(`Profile fetch failed: ${a.status}`);
        r = await a.json(), console.log("   ✅ Profile data:", r);
      }
      this.currentSession = {
        ...e,
        handle: r.handle,
        displayName: r.displayName || r.handle,
        avatar: r.avatar,
        did: e.sub,
        profile: {
          handle: r.handle,
          displayName: r.displayName,
          description: r.description,
          avatar: r.avatar,
          banner: r.banner,
          followersCount: r.followersCount,
          followsCount: r.followsCount,
          postsCount: r.postsCount,
          indexedAt: r.indexedAt,
          createdAt: r.createdAt,
          labels: r.labels
        }
      }, console.log("✅ Profile loaded!"), console.log("   Handle:", this.currentSession.handle), console.log("   Display Name:", this.currentSession.displayName), console.log("   Avatar:", this.currentSession.avatar);
    } catch (r) {
      console.error("❌ Profile fetch failed:", r.message), this.currentSession = {
        ...e,
        did: e.sub,
        handle: e.sub,
        displayName: e.sub,
        profile: null
      };
    }
  }
  async checkIfReverieAccount(e) {
    try {
      const r = await this._resolveDIDDocument(e);
      if (r != null && r.service) {
        const n = r.service.find((s) => s.id === "#atproto_pds");
        return (n == null ? void 0 : n.serviceEndpoint) === "https://reverie.house";
      }
      return !1;
    } catch {
      return !1;
    }
  }
  async login(e, r = null, n = {}) {
    var o;
    await this.ensureInitialized(), console.log("🔐 Starting OAuth login for:", e), e = e.trim().toLowerCase(), e.startsWith("@") && (e = e.substring(1));
    const s = n.scope || "atproto transition:generic";
    console.log("🔑 Requesting scope:", s);
    let a = r;
    if (!a) {
      const i = sessionStorage.getItem("oauth_return_to");
      i && (a = i, sessionStorage.removeItem("oauth_return_to"), console.log("🏠 Using saved return destination:", a));
    }
    if (!a) {
      const i = window.location.pathname;
      i !== "/" && i !== "/index.html" && !i.includes("/oauth-callback") ? a = i + window.location.search : a = "/story";
    }
    console.log("🏠 Will return to:", a);
    try {
      await this.client.signIn(e, {
        state: a,
        scope: s
      });
    } catch (i) {
      throw console.error("❌ OAuth login error:", i), (o = i.message) != null && o.includes("back") ? new Error("Login cancelled") : i;
    }
  }
  getSession() {
    if (this.currentSession)
      return this.currentSession;
    try {
      const e = localStorage.getItem("pds_session");
      if (e) {
        const r = JSON.parse(e);
        return this.currentSession = r, console.log("✅ Restored PDS session from localStorage:", r.handle), this.currentSession;
      }
    } catch (e) {
      console.error("❌ Error restoring PDS session:", e);
    }
    return null;
  }
  async createPost(e, r = null) {
    if (await this.ensureInitialized(), !this.currentSession)
      throw new Error("Not logged in");
    console.log("📝 Creating post:", e.substring(0, 50) + (e.length > 50 ? "..." : ""));
    let n = null;
    typeof r == "string" ? (n = r, r = null) : r && r.reply && console.log("   Reply detected in custom record"), n && console.log("   Reply to:", n);
    try {
      const s = await this._resolveDIDDocument(this.currentSession.sub);
      if (!s || !s.service)
        throw new Error("Could not resolve PDS endpoint");
      const a = s.service.find((d) => d.id === "#atproto_pds" || d.type === "AtprotoPersonalDataServer");
      if (!a || !a.serviceEndpoint)
        throw new Error("No PDS service found in DID document");
      const o = a.serviceEndpoint;
      console.log("   PDS endpoint:", o);
      const i = {
        $type: "app.bsky.feed.post",
        text: e,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        ...r || {}
      };
      if (n) {
        const d = await this._getPostCID(n, o);
        if (!d)
          throw new Error("Failed to fetch parent post CID");
        i.reply = {
          root: {
            uri: n,
            cid: d
          },
          parent: {
            uri: n,
            cid: d
          }
        }, console.log("   Reply metadata added (parent CID:", d + ")");
      }
      i.facets && (console.log("   Resolving DIDs for facets..."), i.facets = await this._resolveFacetDIDs(i.facets));
      const c = localStorage.getItem("pds_session");
      if (c) {
        const d = JSON.parse(c), u = `${o}/xrpc/com.atproto.repo.createRecord`, l = {
          repo: d.did,
          collection: "app.bsky.feed.post",
          record: i
        };
        console.log("   Creating record via PDS session at:", u);
        const p = await fetch(u, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${d.accessJwt}`
          },
          body: JSON.stringify(l)
        });
        if (!p.ok) {
          const _ = await p.text();
          throw new Error(`Post creation failed (${p.status}): ${_}`);
        }
        const f = await p.json();
        return console.log("✅ Post created:", f.uri), {
          uri: f.uri,
          cid: f.cid
        };
      } else {
        console.log("   OAuth-only session, checking for stored credentials...");
        const d = localStorage.getItem("oauth_token");
        let u = !1;
        if (d)
          try {
            const _ = await fetch("/api/user/credentials/status", {
              headers: { Authorization: `Bearer ${d}` }
            });
            _.ok && (u = (await _.json()).connected === !0);
          } catch (_) {
            console.warn("Could not check credential status:", _);
          }
        if (!u && (console.log("   No stored credentials, prompting for app password..."), !await this._requestCredentials()))
          throw new Error("App password required to post");
        const l = localStorage.getItem("oauth_token"), p = await fetch("/api/post/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: l ? `Bearer ${l}` : ""
          },
          body: JSON.stringify({
            user_did: this.currentSession.sub || this.currentSession.did,
            record: i
          })
        });
        if (!p.ok) {
          const _ = await p.json();
          throw new Error(_.error || `Post creation failed: ${p.status}`);
        }
        const f = await p.json();
        return console.log("✅ Post created via server:", f.uri), {
          uri: f.uri,
          cid: f.cid
        };
      }
    } catch (s) {
      throw console.error("❌ Failed to create post:", s), s;
    }
  }
  async _requestCredentials() {
    return new Promise((e) => {
      if (!window.appPasswordRequest) {
        console.error("❌ AppPasswordRequest widget not available"), e(!1);
        return;
      }
      window.appPasswordRequest.show({
        title: "Connect Account",
        description: "<p>To post from Reverie House, we need permission to act on your behalf.</p>",
        featureName: "posting",
        buttonText: "CONNECT ACCOUNT"
      }, async (r) => {
        try {
          const n = localStorage.getItem("oauth_token"), s = await fetch("/api/user/credentials/connect", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${n}`
            },
            body: JSON.stringify({ app_password: r })
          });
          if (!s.ok) {
            const a = await s.json();
            throw new Error(a.error || "Failed to store credentials");
          }
          console.log("✅ Credentials stored successfully"), e(!0);
        } catch (n) {
          throw console.error("❌ Failed to store credentials:", n), n;
        }
      });
    });
  }
  async _promptForCredentials() {
    if (!this.getSession()) {
      console.warn("⚠️ No session for credential prompt");
      return;
    }
    try {
      const r = localStorage.getItem("oauth_token");
      if (r) {
        const n = await fetch("/api/user/credentials/status", {
          headers: { Authorization: `Bearer ${r}` }
        });
        if (n.ok && (await n.json()).connected) {
          console.log("✅ Already has stored credentials");
          return;
        }
      }
    } catch (r) {
      console.warn("Could not check credential status:", r);
    }
    try {
      await this._requestCredentials(), console.log("✅ Main Door credentials setup complete");
    } catch (r) {
      console.warn("⚠️ Credential prompt cancelled or failed:", r);
    }
  }
  async uploadBlob(e, r = "image/png") {
    if (await this.ensureInitialized(), !this.currentSession)
      throw new Error("Not logged in");
    console.log("📤 Uploading blob:", r, e.size, "bytes");
    try {
      const n = await this._resolveDIDDocument(this.currentSession.sub);
      if (!n || !n.service)
        throw new Error("Could not resolve PDS endpoint");
      const s = n.service.find((u) => u.id === "#atproto_pds" || u.type === "AtprotoPersonalDataServer");
      if (!s || !s.serviceEndpoint)
        throw new Error("No PDS service found in DID document");
      const a = s.serviceEndpoint, o = await this.client.restore(this.currentSession.sub), i = "/xrpc/com.atproto.repo.uploadBlob";
      console.log("   Uploading to:", a + i);
      const c = await o.fetchHandler(i, {
        method: "POST",
        headers: {
          "Content-Type": r
        },
        body: e
      });
      if (!c.ok) {
        const u = await c.text();
        throw new Error(`Blob upload failed (${c.status}): ${u}`);
      }
      const d = await c.json();
      return console.log("✅ Blob uploaded:", d.blob), d;
    } catch (n) {
      throw console.error("❌ Failed to upload blob:", n), n;
    }
  }
  async _resolveFacetDIDs(e) {
    const r = [];
    for (const n of e) {
      const s = { ...n };
      for (const a of n.features)
        if (a.$type === "app.bsky.richtext.facet#mention" && !a.did.startsWith("did:"))
          try {
            const o = await this._resolveHandle(a.did);
            a.did = o, console.log(`   Resolved @${a.did} to ${o}`);
          } catch (o) {
            console.warn(`   Could not resolve handle ${a.did}:`, o.message);
          }
      r.push(s);
    }
    return r;
  }
  async _resolveHandle(e) {
    try {
      const r = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${e}`);
      if (r.ok)
        return (await r.json()).did;
      throw new Error(`Handle resolution failed: ${r.status}`);
    } catch (r) {
      throw console.error("Error resolving handle:", r), r;
    }
  }
  async _resolveDIDDocument(e) {
    try {
      if (e.startsWith("did:plc:")) {
        const r = await fetch(`https://plc.directory/${e}`);
        if (r.ok)
          return await r.json();
      } else if (e.startsWith("did:web:")) {
        const r = e.replace("did:web:", "").replace(/%3A/g, ":"), n = await fetch(`https://${r}/.well-known/did.json`);
        if (n.ok)
          return await n.json();
      }
      throw new Error("Could not resolve DID document");
    } catch (r) {
      throw console.error("Error resolving DID:", r), r;
    }
  }
  async _getPostCID(e, r) {
    try {
      const n = e.replace("at://", "").split("/"), s = n[0], a = n.slice(1, -1).join("/"), o = n[n.length - 1], i = `${r}/xrpc/com.atproto.repo.getRecord?repo=${s}&collection=${a}&rkey=${o}`, c = await fetch(i);
      if (c.ok)
        return (await c.json()).cid;
      const d = `https://public.api.bsky.app/xrpc/com.atproto.repo.getRecord?repo=${s}&collection=${a}&rkey=${o}`, u = await fetch(d);
      if (u.ok)
        return (await u.json()).cid;
      throw new Error("Could not fetch post CID");
    } catch (n) {
      return console.error("Error getting post CID:", n), null;
    }
  }
  /**
   * Generic createRecord — writes any AT Proto record to the user's PDS.
   * Supports both OAuth DPoP sessions and PDS app-password sessions.
   * @param {string} collection - e.g. 'farm.lore.content'
   * @param {object} record - Record fields (without $type, added automatically)
   * @param {string} [rkey] - Optional record key
   * @returns {{ uri: string, cid: string }}
   */
  async createRecord(e, r, n) {
    var i, c, d;
    if (await this.ensureInitialized(), !this.currentSession)
      throw new Error("Not logged in");
    const s = this.currentSession.sub || this.currentSession.did, a = {
      repo: s,
      collection: e,
      record: { $type: e, ...r }
    };
    n && (a.rkey = n);
    const o = localStorage.getItem("pds_session");
    if (o) {
      const u = JSON.parse(o), l = await this._resolveDIDDocument(s), p = (i = l == null ? void 0 : l.service) == null ? void 0 : i.find((S) => S.id === "#atproto_pds"), f = p == null ? void 0 : p.serviceEndpoint;
      if (!f) throw new Error("Could not resolve PDS endpoint");
      const _ = await fetch(`${f}/xrpc/com.atproto.repo.createRecord`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${u.accessJwt}`
        },
        body: JSON.stringify(a)
      });
      if (_.status === 401)
        throw new Error("Session expired. Please log in again.");
      if (!_.ok) {
        const S = await _.text();
        throw new Error(`createRecord failed (${_.status}): ${S}`);
      }
      const g = await _.json();
      return console.log(`✅ Record created [${e}]:`, g.uri), { uri: g.uri, cid: g.cid };
    }
    try {
      const l = await (await this.client.restore(s)).fetchHandler("/xrpc/com.atproto.repo.createRecord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(a)
      });
      if (!l.ok) {
        const f = await l.text();
        throw new Error(`createRecord failed (${l.status}): ${f}`);
      }
      const p = await l.json();
      return console.log(`✅ Record created [${e}]:`, p.uri), { uri: p.uri, cid: p.cid };
    } catch (u) {
      throw (c = u.message) != null && c.includes("deleted") || (d = u.message) != null && d.includes("expired") ? (this.currentSession = null, window.dispatchEvent(new CustomEvent("oauth:logout", {
        detail: { sub: s, cause: u.message }
      })), new Error("Your session has expired. Please log in again.")) : u;
    }
  }
  /**
   * Generic deleteRecord — removes a record from the user's PDS.
   * Supports both OAuth DPoP sessions and PDS app-password sessions.
   * @param {string} collection - e.g. 'farm.lore.character'
   * @param {string} rkey - The record key to delete
   */
  async deleteRecord(e, r) {
    var a, o, i;
    if (await this.ensureInitialized(), !this.currentSession)
      throw new Error("Not logged in");
    const n = this.currentSession.sub || this.currentSession.did, s = localStorage.getItem("pds_session");
    if (s) {
      const c = JSON.parse(s), d = await this._resolveDIDDocument(n), u = (a = d == null ? void 0 : d.service) == null ? void 0 : a.find((f) => f.id === "#atproto_pds"), l = u == null ? void 0 : u.serviceEndpoint;
      if (!l) throw new Error("Could not resolve PDS endpoint");
      const p = await fetch(`${l}/xrpc/com.atproto.repo.deleteRecord`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${c.accessJwt}`
        },
        body: JSON.stringify({ repo: n, collection: e, rkey: r })
      });
      if (!p.ok) {
        const f = await p.text();
        throw new Error(`deleteRecord failed (${p.status}): ${f}`);
      }
      console.log(`✅ Record deleted [${e}]: ${r}`);
      return;
    }
    try {
      const d = await (await this.client.restore(n)).fetchHandler("/xrpc/com.atproto.repo.deleteRecord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: n, collection: e, rkey: r })
      });
      if (!d.ok) {
        const u = await d.text();
        throw new Error(`deleteRecord failed (${d.status}): ${u}`);
      }
      console.log(`✅ Record deleted [${e}]: ${r}`);
    } catch (c) {
      throw (o = c.message) != null && o.includes("deleted") || (i = c.message) != null && i.includes("expired") ? (this.currentSession = null, window.dispatchEvent(new CustomEvent("oauth:logout", {
        detail: { sub: n, cause: c.message }
      })), new Error("Your session has expired. Please log in again.")) : c;
    }
  }
  async autoRegister(e) {
    var r, n, s;
    try {
      console.log("🔄 OAuth Manager auto-register called for:", e);
      const a = { did: e };
      (r = this.currentSession) != null && r.profile && (a.profile = this.currentSession.profile, console.log("   Including profile data in payload")), console.log("   Calling /api/auto-register...");
      const o = await fetch("/api/auto-register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(a)
      });
      if (console.log(`   Response status: ${o.status}`), o.ok) {
        const i = await o.json();
        console.log("   Response data:", i), i.token && (localStorage.setItem("oauth_token", i.token), console.log("🔐 OAuth token stored")), i.newly_registered ? console.log("✨ Auto-registered new dreamer:", ((n = i.dreamer) == null ? void 0 : n.name) || "unnamed") : i.already_registered && (console.log("✅ Dreamer already registered"), (s = i.dreamer) != null && s.has_name ? console.log(`   Name: ${i.dreamer.name}`) : console.log("   No name claimed yet"));
      } else {
        const i = await o.text();
        console.error("❌ Auto-register failed:", o.status, i);
      }
    } catch (a) {
      console.error("❌ Error auto-registering:", a), console.error("   Stack:", a.stack);
    }
  }
  async logout() {
    if (!this.currentSession) {
      console.log("⚠️ No session to logout");
      return;
    }
    try {
      await this.ensureInitialized(), this.client && !localStorage.getItem("pds_session") && await this.client.revoke(this.currentSession.sub), console.log("✅ Logged out");
    } catch (e) {
      console.error("❌ Logout error:", e);
    } finally {
      this.currentSession = null, localStorage.removeItem("oauth_token"), localStorage.removeItem("admin_token"), localStorage.removeItem("pds_session"), localStorage.removeItem("BSKY_AGENT(sub)"), sessionStorage.removeItem("admin_session"), sessionStorage.clear(), console.log("🔄 Dispatching oauth:logout event..."), window.dispatchEvent(new CustomEvent("oauth:logout")), console.log("🔄 Forcing page reload after logout..."), setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  }
  /**
   * Upgrade a Side Door session to Main Door by logging out and
   * immediately re-initiating OAuth with full scope.
   * The user is seamlessly redirected to authorize with write access.
   */
  async upgradeToMainDoor() {
    var r, n;
    const e = ((r = this.currentSession) == null ? void 0 : r.handle) || ((n = this.currentSession) == null ? void 0 : n.sub);
    if (!e) {
      console.warn("⚠️ No session to upgrade");
      return;
    }
    console.log("⬆️ Upgrading Side Door to Main Door for:", e);
    try {
      await this.ensureInitialized(), this.client && !localStorage.getItem("pds_session") && await this.client.revoke(this.currentSession.sub);
    } catch (s) {
      console.error("⚠️ Revoke during upgrade failed (continuing):", s);
    }
    this.currentSession = null, localStorage.removeItem("oauth_token"), localStorage.removeItem("admin_token"), localStorage.removeItem("BSKY_AGENT(sub)"), sessionStorage.removeItem("admin_session"), localStorage.setItem("mainDoorLogin", "true"), localStorage.removeItem("sideDoorLogin"), await this.login(e, null, { scope: "atproto transition:generic" });
  }
  async ensureInitialized() {
    this.client || await this.init();
  }
}
const ph = new CS();
ph.init().catch((t) => {
  console.error("Failed to initialize OAuth:", t);
});
window.oauthManager = ph;
console.log("🔐 OAuth Manager (SDK) loaded");
export {
  ph as default
};
