(function(Object){
   typeof globalThis !== "object"
   &&
    (this
      ? get()
      : (Object.defineProperty
         (Object.prototype, "_T_", {configurable: true, get: get}),
        _T_));
   function get(){
    var global = this || self;
    global.globalThis = global;
    delete Object.prototype._T_;
   }
  }
  (Object));
(js=>
     async args=>{
      "use strict";
      const
       {link, src, generated, disable_effects} = args,
       isNode = globalThis.process?.versions?.node,
       math =
         {cos: Math.cos,
          sin: Math.sin,
          tan: Math.tan,
          acos: Math.acos,
          asin: Math.asin,
          atan: Math.atan,
          cosh: Math.cosh,
          sinh: Math.sinh,
          tanh: Math.tanh,
          acosh: Math.acosh,
          asinh: Math.asinh,
          atanh: Math.atanh,
          cbrt: Math.cbrt,
          exp: Math.exp,
          expm1: Math.expm1,
          log: Math.log,
          log1p: Math.log1p,
          log2: Math.log2,
          log10: Math.log10,
          atan2: Math.atan2,
          hypot: Math.hypot,
          pow: Math.pow,
          fmod: (x, y)=>x % y},
       typed_arrays =
         [Float32Array,
          Float64Array,
          Int8Array,
          Uint8Array,
          Int16Array,
          Uint16Array,
          Int32Array,
          Int32Array,
          Int32Array,
          Int32Array,
          Float32Array,
          Float64Array,
          Uint8Array,
          Uint16Array,
          Uint8ClampedArray],
       fs = isNode && require("node:fs"),
       virtual_files = new Map(),
       virtual_dirs = new Set(),
       virtual_fds = new Map();
      let next_virtual_fd = 1000000;
      function register_virtual_file(name, content){
       virtual_files.set(name, content);
       let dir = name;
       while(true){
        const i = dir.lastIndexOf("/");
        if(i <= 0) break;
        dir = dir.slice(0, i);
        virtual_dirs.add(dir);
       }
      }
      if(args.files)
       for(const [name, data] of Object.entries(args.files))
        register_virtual_file
         (name, Uint8Array.from(atob(data), c=>c.charCodeAt(0)));
      const
       fs_cst = fs?.constants,
       access_flags =
         fs ? [fs_cst.R_OK, fs_cst.W_OK, fs_cst.X_OK, fs_cst.F_OK] : [],
       open_flags =
         fs
          ? [fs_cst.O_RDONLY,
            fs_cst.O_WRONLY,
            fs_cst.O_RDWR,
            fs_cst.O_APPEND,
            fs_cst.O_CREAT,
            fs_cst.O_TRUNC,
            fs_cst.O_EXCL,
            fs_cst.O_NONBLOCK,
            fs_cst.O_NOCTTY,
            fs_cst.O_DSYNC,
            fs_cst.O_SYNC]
          : [];
      var
       out_channels =
         {map: new WeakMap(),
          set: new Set(),
          finalization:
          new FinalizationRegistry(ref=>out_channels.set.delete(ref))};
      function register_channel(ch){
       const ref = new WeakRef(ch);
       out_channels.map.set(ch, ref);
       out_channels.set.add(ref);
       out_channels.finalization.register(ch, ref, ch);
      }
      function unregister_channel(ch){
       const ref = out_channels.map.get(ch);
       if(ref){
        out_channels.map.delete(ch);
        out_channels.set.delete(ref);
        out_channels.finalization.unregister(ch);
       }
      }
      function channel_list(){
       return [...out_channels.set].map(ref=>ref.deref()).filter(ch=>ch);
      }
      var start_fiber;
      function make_suspending(f){
       return WebAssembly?.Suspending ? new WebAssembly.Suspending(f) : f;
      }
      function make_promising(f){
       return ! disable_effects && WebAssembly?.promising && f
               ? WebAssembly.promising(f)
               : f;
      }
      const
       decoder = new TextDecoder("utf-8", {ignoreBOM: 1}),
       encoder = new TextEncoder();
      function hash_int(h, d){
       d = Math.imul(d, 0xcc9e2d51 | 0);
       d = d << 15 | d >>> 17;
       d = Math.imul(d, 0x1b873593);
       h ^= d;
       h = h << 13 | h >>> 19;
       return (h + (h << 2) | 0) + (0xe6546b64 | 0) | 0;
      }
      function jsstring_is_bytes(s){
       for(var i = 0; i < s.length; i++)
        if(s.charCodeAt(i) > 0xff) return false;
       return true;
      }
      function caml_hash_mix_jsbytes(h, s){
       var len = s.length, i, w;
       for(i = 0; i + 4 <= len; i += 4){
        w =
         s.charCodeAt(i) | s.charCodeAt(i + 1) << 8
         | s.charCodeAt(i + 2) << 16
         | s.charCodeAt(i + 3) << 24;
        h = hash_int(h, w);
       }
       w = 0;
       switch(len & 3){
         case 3:
          w = s.charCodeAt(i + 2) << 16;
         case 2:
          w |= s.charCodeAt(i + 1) << 8;
         case 1:
          w |= s.charCodeAt(i); h = hash_int(h, w);
       }
       return h ^ len;
      }
      function hash_string(h, s){
       if(jsstring_is_bytes(s)) return caml_hash_mix_jsbytes(h, s);
       var len = s.length, i, w;
       for(i = 0; i + 2 <= len; i += 2){
        w = s.charCodeAt(i) | s.charCodeAt(i + 1) << 16;
        h = hash_int(h, w);
       }
       if(len & 1) h = hash_int(h, s.charCodeAt(i));
       return h ^ len;
      }
      function getenv(n){
       if(isNode && globalThis.process.env[n] !== undefined)
        return globalThis.process.env[n];
       return globalThis.jsoo_env?.[n];
      }
      let record_backtrace_flag = 0;
      for(const l of getenv("OCAMLRUNPARAM")?.split(",") || []){
       if(l === "b") record_backtrace_flag = 1;
       if(l.startsWith("b=")) record_backtrace_flag = + l.slice(2) ? 1 : 0;
      }
      function alloc_stat(s, large){
       var kind;
       if(s.isFile())
        kind = 0;
       else if(s.isDirectory())
        kind = 1;
       else if(s.isCharacterDevice())
        kind = 2;
       else if(s.isBlockDevice())
        kind = 3;
       else if(s.isSymbolicLink())
        kind = 4;
       else if(s.isFIFO()) kind = 5; else if(s.isSocket()) kind = 6;
       return caml_alloc_stat
               (large,
                s.dev,
                s.ino | 0,
                kind,
                s.mode & 0o7777,
                s.nlink,
                s.uid,
                s.gid,
                s.rdev,
                BigInt(s.size),
                s.atimeMs / 1000,
                s.mtimeMs / 1000,
                s.ctimeMs / 1000);
      }
      const
       on_windows = isNode && globalThis.process.platform === "win32",
       on_arm64 = globalThis.process?.arch === "arm64",
       isV8 = new Error().stack?.includes("\n    at ") ?? false,
       call = Function.prototype.call,
       DV = DataView.prototype,
       bindings =
         {jstag:
          WebAssembly.JSTag
          || new WebAssembly.Tag({parameters: ["externref"], results: []}),
          identity: x=>x,
          from_bool: x=>! ! x,
          get: (x, y)=>x[y],
          set: (x, y, z)=>x[y] = z,
          delete: (x, y)=>delete x[y],
          instanceof: (x, y)=>x instanceof y,
          is_js_error: x=>x instanceof Error,
          to_js_string: x=>String(x),
          typeof: x=>typeof x,
          equals: (x, y)=>x == y,
          strict_equals: (x, y)=>x === y,
          fun_call: (f, o, args)=>f.apply(o, args),
          meth_call: (o, f, args)=>o[f].apply(o, args),
          new_array: n=>new Array(n),
          new_obj: ()=>({}),
          new: (c, args)=>new c(...args),
          global_this: globalThis,
          iter_props:
          (o, f)=>{for(var nm in o) if(Object.hasOwn(o, nm)) f(nm);},
          array_length: a=>a.length,
          array_get: (a, i)=>a[i],
          array_set: (a, i, v)=>a[i] = v,
          read_string: l=>decoder.decode(new Uint8Array(buffer, 0, l)),
          read_string_stream:
          (l, stream)=>
             decoder.decode(new Uint8Array(buffer, 0, l), {stream: stream}),
          append_string: (s1, s2)=>s1 + s2,
          write_string:
          s=>{
           var start = 0, len = s.length;
           for(;;){
            const
             {read, written} = encoder.encodeInto(s.slice(start), out_buffer);
            len -= read;
            if(! len) return written;
            caml_extract_bytes(written);
            start += read;
           }},
          ta_create: (k, sz)=>new typed_arrays[k](sz),
          ta_normalize:
          a=>
             a instanceof Uint32Array
              ? new Int32Array(a.buffer, a.byteOffset, a.length)
              : a,
          ta_kind: a=>typed_arrays.findIndex(c=>a instanceof c),
          ta_length: a=>a.length,
          ta_get_i32: (a, i)=>a[i],
          ta_fill: (a, v)=>a.fill(v),
          ta_blit: (s, d)=>d.set(s),
          ta_subarray: (a, i, j)=>a.subarray(i, j),
          ta_set: (a, b, i)=>a.set(b, i),
          ta_new: len=>new Uint8Array(len),
          ta_copy: (ta, t, s, e)=>ta.copyWithin(t, s, e),
          ta_bytes:
          a=>
             new
              Uint8Array
              (a.buffer, a.byteOffset, a.length * a.BYTES_PER_ELEMENT),
          dv_make: a=>new DataView(a.buffer, a.byteOffset, a.byteLength),
          dv_get_f64: call.bind(DV.getFloat64),
          dv_get_f32: call.bind(DV.getFloat32),
          dv_get_i64: call.bind(DV.getBigInt64),
          dv_get_i32:
          isV8 ? call.bind(DV.getInt32) : (x, y, z)=>x.getInt32(y, z),
          dv_get_i16: call.bind(DV.getInt16),
          dv_get_ui16: call.bind(DV.getUint16),
          dv_get_i8: call.bind(DV.getInt8),
          dv_get_ui8: call.bind(DV.getUint8),
          dv_set_f64: call.bind(DV.setFloat64),
          dv_set_f32: call.bind(DV.setFloat32),
          dv_set_i64: call.bind(DV.setBigInt64),
          dv_set_i32: call.bind(DV.setInt32),
          dv_set_i16: call.bind(DV.setInt16),
          dv_set_i8: call.bind(DV.setInt8),
          littleEndian: new Uint8Array(new Uint32Array([1]).buffer)[0],
          wrap_callback:
          f=>
             function(...args){
              if(args.length === 0) args = [undefined];
              return caml_callback(f, args.length, args, 1);
             },
          wrap_callback_args:
          f=>function(...args){return caml_callback(f, 1, [args], 0);},
          wrap_callback_strict:
          (arity, f)=>
             function(...args){
              args.length = arity;
              return caml_callback(f, arity, args, 0);
             },
          wrap_callback_unsafe:
          f=>function(...args){return caml_callback(f, args.length, args, 2);},
          wrap_meth_callback:
          f=>
             function(...args){
              args.unshift(this);
              return caml_callback(f, args.length, args, 1);
             },
          wrap_meth_callback_args:
          f=>function(...args){return caml_callback(f, 2, [this, args], 0);},
          wrap_meth_callback_strict:
          (arity, f)=>
             function(...args){
              args.length = arity;
              args.unshift(this);
              return caml_callback(f, args.length, args, 0);
             },
          wrap_meth_callback_unsafe:
          f=>
             function(...args){
              args.unshift(this);
              return caml_callback(f, args.length, args, 2);
             },
          wrap_fun_arguments: f=>function(...args){return f(args);},
          format_float:
          (prec, conversion, pad, x)=>{
           function decompose(x){
            var dv = new DataView(new ArrayBuffer(8));
            dv.setFloat64(0, x);
            var
             hi = dv.getUint32(0),
             lo = dv.getUint32(4),
             eb = hi >>> 20 & 0x7ff,
             m = BigInt(hi & 0xfffff) << 32n | BigInt(lo);
            if(eb === 0) return [m, - 1074];
            return [m | 1n << 52n, eb - 1075];
           }
           function exact_scaled(x, k){
            var d = decompose(x), num = d[0], den = 1n;
            if(k >= 0) num *= 10n ** BigInt(k); else den = 10n ** BigInt(- k);
            if(d[1] >= 0) num <<= BigInt(d[1]); else den <<= BigInt(- d[1]);
            var q = num / den, r2 = num % den * 2n;
            if(r2 > den || r2 === den && q & 1n) q += 1n;
            return q;
           }
           function exact_fixed(x, prec){
            var q = exact_scaled(x, prec).toString();
            if(prec === 0) return q;
            if(q.length <= prec) q = "0".repeat(prec + 1 - q.length) + q;
            return q.slice(0, q.length - prec) + "."
                   + q.slice(q.length - prec);
           }
           function exact_exponential(x, prec){
            if(x === 0)
             return (prec > 0 ? "0." + "0".repeat(prec) : "0") + "e+0";
            var e10 = Math.floor(Math.log10(x));
            for(;;){
             var s = exact_scaled(x, prec - e10).toString();
             if(s.length === prec + 1){
              var m = prec > 0 ? s.charAt(0) + "." + s.slice(1) : s;
              return m + "e" + (e10 < 0 ? "-" : "+") + Math.abs(e10);
             }
             e10 += s.length - (prec + 1);
            }
           }
           function toExponential(x, prec){
            return prec > 100
                    ? exact_exponential(x, prec)
                    : x.toExponential(prec);
           }
           function toFixed(x, dp){
            if(dp > 100 || x >= 1e21) return exact_fixed(x, dp);
            return x.toFixed(dp);
           }
           switch(conversion){
             case 0:
              var s = toExponential(x, prec), i = s.length;
              if(s.charAt(i - 3) === "e")
               s = s.slice(0, i - 1) + "0" + s.slice(i - 1);
              break;
             case 1:
              s = toFixed(x, prec); break;
             case 2:
              prec = prec ? prec : 1;
              s = toExponential(x, prec - 1);
              var j = s.indexOf("e"), exp = + s.slice(j + 1);
              if(exp < - 4 || x >= 1e21 || x.toFixed(0).length > prec){
               var i = j - 1;
               while(s.charAt(i) === "0") i--;
               if(s.charAt(i) === ".") i--;
               s = s.slice(0, i + 1) + s.slice(j);
               i = s.length;
               if(s.charAt(i - 3) === "e")
                s = s.slice(0, i - 1) + "0" + s.slice(i - 1);
               break;
              }
              else{
               var p = prec;
               if(exp < 0){
                p -= exp + 1;
                s = toFixed(x, p);
               }
               else
                while(s = toFixed(x, p), s.length > prec + 1) p--;
               if(p){
                var i = s.length - 1;
                while(s.charAt(i) === "0") i--;
                if(s.charAt(i) === ".") i--;
                s = s.slice(0, i + 1);
               }
              }
              break;
           }
           return pad ? " " + s : s;},
          gettimeofday: ()=>Date.now() / 1000,
          times:
          ()=>{
           if(globalThis.process?.cpuUsage){
            var t = globalThis.process.cpuUsage();
            return caml_alloc_times(t.user / 1e6, t.system / 1e6);
           }
           else{
            var t = performance.now() / 1000;
            return caml_alloc_times(t, 0);
           }},
          gmtime:
          t=>{
           var
            d = new Date(t * 1000),
            d_num = d.getTime(),
            januaryfirst =
              new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).getTime(),
            doy = Math.floor((d_num - januaryfirst) / 86400000);
           return caml_alloc_tm
                   (d.getUTCSeconds(),
                    d.getUTCMinutes(),
                    d.getUTCHours(),
                    d.getUTCDate(),
                    d.getUTCMonth(),
                    d.getUTCFullYear() - 1900,
                    d.getUTCDay(),
                    doy,
                    false);},
          localtime:
          t=>{
           var
            d = new Date(t * 1000),
            doy =
              Math.floor
               ((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
                - Date.UTC(d.getFullYear(), 0, 1))
                / 86400000),
            jan = new Date(d.getFullYear(), 0, 1),
            jul = new Date(d.getFullYear(), 6, 1),
            stdTimezoneOffset =
              Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset()),
            isdst = d.getTimezoneOffset() < stdTimezoneOffset;
           if
            (stdTimezoneOffset === 0
             && jan.getTimezoneOffset() !== jul.getTimezoneOffset()
             &&
              globalThis.Intl?.DateTimeFormat?.().resolvedOptions().timeZone
              === "Europe/Dublin")
            isdst = ! isdst;
           return caml_alloc_tm
                   (d.getSeconds(),
                    d.getMinutes(),
                    d.getHours(),
                    d.getDate(),
                    d.getMonth(),
                    d.getFullYear() - 1900,
                    d.getDay(),
                    doy,
                    isdst);},
          mktime:
          (year, month, day, h, m, s)=>
             new Date(year, month, day, h, m, s).getTime(),
          random_seed: ()=>crypto.getRandomValues(new Int32Array(12)),
          access:
          (p, flags)=>
             fs.accessSync
              (p,
               access_flags.reduce((f, v, i)=>flags & 1 << i ? f | v : f, 0)),
          open:
          (p, flags, perm)=>{
           if(virtual_files.has(p) && ! (flags & 2)){
            const fd = next_virtual_fd++;
            virtual_fds.set(fd, {data: virtual_files.get(p), offset: 0});
            return fd;
           }
           return fs.openSync
                   (p,
                    open_flags.reduce((f, v, i)=>flags & 1 << i ? f | v : f, 0),
                    perm);},
          close:
          fd=>{
           if(virtual_fds.has(fd)){virtual_fds.delete(fd); return;}
           fs.closeSync(fd);},
          write:
          (fd, b, o, l, p)=>
             fs
              ? fs.writeSync(fd, b, o, l, p === null ? p : Number(p))
              : (console
                  [fd === 2 ? "error" : "log"]
                 (typeof b === "string"
                   ? b
                   : decoder.decode(b.slice(o, o + l))),
                l),
          read:
          (fd, b, o, l, p)=>{
           const vf = virtual_fds.get(fd);
           if(vf){
            const
             pos = p === null ? vf.offset : Number(p),
             n = Math.min(l, vf.data.length - pos);
            if(n <= 0) return 0;
            b.set(vf.data.subarray(pos, pos + n), o);
            vf.offset = pos + n;
            return n;
           }
           return fs.readSync(fd, b, o, l, p);},
          fsync: fd=>fs.fsyncSync(fd),
          file_size:
          fd=>{
           const vf = virtual_fds.get(fd);
           if(vf) return BigInt(vf.data.length);
           return fs.fstatSync(fd, {bigint: true}).size;},
          register_channel: register_channel,
          unregister_channel: unregister_channel,
          channel_list: channel_list,
          exit: n=>isNode && globalThis.process.exit(n),
          argv: ()=>isNode ? globalThis.process.argv.slice(1) : ["a.out"],
          on_windows: + on_windows,
          on_arm64: + on_arm64,
          getenv: getenv,
          backtrace_status: ()=>record_backtrace_flag,
          record_backtrace: b=>record_backtrace_flag = b,
          system:
          c=>{
           var
            res =
              require("node:child_process").spawnSync
               (c, {shell: true, stdio: "inherit"});
           if(res.error) throw res.error;
           return res.signal ? 255 : res.status;},
          isatty: fd=>isNode ? + require("node:tty").isatty(fd) : 0,
          getuid:
          ()=>globalThis.process?.getuid ? globalThis.process.getuid() : 1,
          geteuid:
          ()=>globalThis.process?.geteuid ? globalThis.process.geteuid() : 1,
          getgid:
          ()=>globalThis.process?.getgid ? globalThis.process.getgid() : 1,
          getegid:
          ()=>globalThis.process?.getegid ? globalThis.process.getegid() : 1,
          time: ()=>performance.now(),
          getcwd: ()=>isNode ? globalThis.process.cwd() : "/static",
          chdir: x=>globalThis.process.chdir(x),
          mkdir: (p, m)=>fs.mkdirSync(p, m),
          rmdir: p=>fs.rmdirSync(p),
          link: (d, s)=>fs.linkSync(d, s),
          symlink:
          (t, p, kind)=>fs.symlinkSync(t, p, [null, "file", "dir"][kind]),
          readlink: p=>fs.readlinkSync(p),
          unlink: p=>fs.unlinkSync(p),
          read_dir:
          p=>{
           const prefix = p.endsWith("/") ? p : p + "/", entries = new Set();
           for(const name of virtual_files.keys())
            if(name.startsWith(prefix)){
             const
              rest = name.slice(prefix.length),
              slash = rest.indexOf("/");
             entries.add(slash < 0 ? rest : rest.slice(0, slash));
            }
           if(fs)
            try{for(const e of fs.readdirSync(p)) entries.add(e);}
            catch(e){if(entries.size === 0) throw e;}
           return [...entries];},
          opendir: p=>({dir: fs.opendirSync(p), dots: [".", ".."]}),
          readdir:
          d=>{
           if(d.dots.length > 0) return d.dots.shift();
           var n = d.dir.readSync()?.name;
           return n === undefined ? null : n;},
          closedir: d=>{d.dots = []; d.dir.closeSync();},
          stat: (p, l)=>alloc_stat(fs.statSync(p), l),
          lstat: (p, l)=>alloc_stat(fs.lstatSync(p), l),
          fstat: (fd, l)=>alloc_stat(fs.fstatSync(fd), l),
          chmod: (p, perms)=>fs.chmodSync(p, perms),
          fchmod: (p, perms)=>fs.fchmodSync(p, perms),
          file_exists:
          p=>{
           if(virtual_files.has(p) || virtual_dirs.has(p)) return 1;
           return fs ? + fs.existsSync(p) : 0;},
          is_directory:
          p=>{
           if(virtual_dirs.has(p)) return 1;
           if(virtual_files.has(p)) return 0;
           return + fs.statSync(p).isDirectory();},
          is_file:
          p=>{
           if(virtual_files.has(p)) return 1;
           if(virtual_dirs.has(p)) return 0;
           return + fs.statSync(p).isFile();},
          utimes: (p, a, m)=>fs.utimesSync(p, a, m),
          truncate: (p, l)=>fs.truncateSync(p, l),
          ftruncate: (fd, l)=>fs.ftruncateSync(fd, l),
          rename:
          (o, n)=>{
           var n_stat;
           if
            (on_windows && (n_stat = fs.statSync(n, {throwIfNoEntry: false}))
             && fs.statSync(o, {throwIfNoEntry: false})?.isDirectory())
            if(n_stat.isDirectory()){
             if(! n.startsWith(o)) try{fs.rmdirSync(n);}catch{}
            }
            else{
             var
              e =
                new Error(`ENOTDIR: not a directory, rename '${o}' -> '${n}'`);
             throw Object.assign
                    (e,
                     {errno: - 20, code: "ENOTDIR", syscall: "rename", path: n});
            }
           fs.renameSync(o, n);},
          tmpdir: ()=>require("node:os").tmpdir(),
          start_fiber: x=>start_fiber(x),
          suspend_fiber: make_suspending((f, env)=>new Promise(k=>f(k, env))),
          resume_fiber: (k, v)=>k(v),
          weak_new: v=>new WeakRef(v),
          weak_deref:
          w=>{var v = w.deref(); return v === undefined ? null : v;},
          weak_map_new: ()=>new WeakMap(),
          map_new: ()=>new Map(),
          map_get:
          (m, x)=>{var v = m.get(x); return v === undefined ? null : v;},
          map_set: (m, x, v)=>m.set(x, v),
          map_delete: (m, x)=>m.delete(x),
          hash_string: hash_string,
          log: x=>console.log(x),
          register_fragments:
          (unitName, fragmentsSource)=>{
           const frags = eval?.(fragmentsSource);
           imports[unitName + ".fragments"] = frags;},
          load_module:
          wasmBytes=>{
           const
            module = new WebAssembly.Module(wasmBytes, options),
            inst = new WebAssembly.Instance(module, imports);
           Object.assign(imports.OCaml, inst.exports);
           return inst.exports["_dynlink.init"]();},
          load_wasmo:
          zipBytes=>{
           const
            dv =
              new
               DataView
               (zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength),
            len = zipBytes.byteLength;
           let eocdOff = len - 22;
           while(eocdOff >= 0 && dv.getUint32(eocdOff, true) !== 0x06054b50)
            eocdOff--;
           if(eocdOff < 0) throw new Error("Invalid ZIP: EOCD not found");
           const
            cdOff = dv.getUint32(eocdOff + 16, true),
            cdEntries = dv.getUint16(eocdOff + 10, true),
            entries = {};
           let off = cdOff;
           for(let i = 0; i < cdEntries; i++){
            if(dv.getUint32(off, true) !== 0x02014b50)
             throw new Error("Invalid ZIP: bad CD entry");
            const
             nameLen = dv.getUint16(off + 28, true),
             extraLen = dv.getUint16(off + 30, true),
             commentLen = dv.getUint16(off + 32, true),
             localOff = dv.getUint32(off + 42, true),
             name =
               decoder.decode(zipBytes.subarray(off + 46, off + 46 + nameLen)),
             size = dv.getUint32(off + 24, true),
             localNameLen = dv.getUint16(localOff + 26, true),
             localExtraLen = dv.getUint16(localOff + 28, true),
             dataOff = localOff + 30 + localNameLen + localExtraLen;
            entries[name] = zipBytes.subarray(dataOff, dataOff + size);
            off += 46 + nameLen + extraLen + commentLen;
           }
           if(! entries["code.wasm"])
            throw new Error("code.wasm not found in .wasmo");
           const
            module = new WebAssembly.Module(entries["code.wasm"], options),
            inst = new WebAssembly.Instance(module, imports);
           Object.assign(imports.OCaml, inst.exports);
           const names = decoder.decode(entries.link_order).split("\x00");
           for(const name of names) inst.exports[name + ".init"]();},
          register_file: (name, data)=>register_virtual_file(name, data),
          read_file: name=>virtual_files.get(name) ?? null},
       string_ops =
         {test: v=>+ (typeof v === "string"),
          compare: (s1, s2)=>s1 < s2 ? - 1 : + (s1 > s2),
          decodeStringFromUTF8Array: ()=>"",
          encodeStringToUTF8Array: ()=>0,
          fromCharCodeArray: ()=>"",
          length: s=>s.length,
          intoCharCodeArray: ()=>0},
       imports =
         Object.assign
          ({Math: math,
            bindings: bindings,
            js: js,
            "wasm:js-string": string_ops,
            "wasm:text-decoder": string_ops,
            "wasm:text-encoder": string_ops,
            str: new globalThis.Proxy({}, {get(_, prop){return prop;}}),
            env: {}},
           generated),
       options =
         {builtins: ["js-string", "text-decoder", "text-encoder"],
          importedStringConstants: "str"};
      function loadRelative(src){
       const
        path = require("node:path"),
        f = path.join(path.dirname(require.main.filename), src);
       return require("node:fs/promises").readFile(f);
      }
      const fetchBase = globalThis?.document?.currentScript?.src;
      function fetchRelative(src){
       const url = fetchBase ? new URL(src, fetchBase) : src;
       return fetch(url);
      }
      const loadCode = isNode ? loadRelative : fetchRelative;
      async function instantiateModule(code){
       return isNode
               ? WebAssembly.instantiate(await code, imports, options)
               : WebAssembly.instantiateStreaming(code, imports, options);
      }
      async function instantiateFromDir(){
       imports.OCaml = {};
       const deps = [];
       async function loadModule(module, isRuntime){
        const sync = module[1].constructor !== Array;
        async function instantiate(){
         const code = loadCode(src + "/" + module[0] + ".wasm");
         await Promise.all(sync ? deps : module[1].map(i=>deps[i]));
         const wasmModule = await instantiateModule(code);
         Object.assign
          (isRuntime ? imports.env : imports.OCaml,
           wasmModule.instance.exports);
        }
        const promise = instantiate();
        deps.push(promise);
        return promise;
       }
       async function loadModules(lst){
        for(const module of lst) await loadModule(module);
       }
       await loadModule(link[0], 1);
       if(link.length > 1){
        await loadModule(link[1]);
        const
         workers = new Array(20).fill(link.slice(2).values()).map(loadModules);
        await Promise.all(workers);
       }
       return {instance: {exports: Object.assign(imports.env, imports.OCaml)}};
      }
      const wasmModule = await instantiateFromDir();
      var
       {caml_callback,
         caml_alloc_times,
         caml_alloc_tm,
         caml_alloc_stat,
         caml_start_fiber,
         caml_handle_uncaught_exception,
         caml_buffer,
         caml_extract_bytes,
         _initialize}
        = wasmModule.instance.exports,
       buffer = caml_buffer?.buffer,
       out_buffer = buffer && new Uint8Array(buffer, 0, buffer.length);
      start_fiber = make_promising(caml_start_fiber);
      var _initialize = make_promising(_initialize);
      if(globalThis.process?.on)
       globalThis.process.on
        ("uncaughtException",
         (err, _origin)=>caml_handle_uncaught_exception(err));
      else if(globalThis.addEventListener)
       globalThis.addEventListener
        ("error",
         event=>event.error && caml_handle_uncaught_exception(event.error));
      await _initialize();})
 (function(globalThis){
    "use strict";
    function caml_js_html_entities(s){
     var entity = /^&#?[0-9a-zA-Z]+;$/;
     if(s.match(entity)){
      var str, temp = document.createElement("p");
      temp.innerHTML = s;
      str = temp.textContent || temp.innerText;
      temp = null;
      return str;
     }
     else
      return null;
    }
    function caml_jsoo_promise_wrapper(x){this.wrapped = x;}
    function caml_jsoo_promise_unwrap(x){
     return x instanceof caml_jsoo_promise_wrapper ? x.wrapped : x;
    }
    function caml_jsoo_promise_wrap(x){
     return x != null && typeof x.then === "function"
             ? new caml_jsoo_promise_wrapper(x)
             : x;
    }
    var
     unix_error =
       ["E2BIG",
        "EACCES",
        "EAGAIN",
        "EBADF",
        "EBUSY",
        "ECHILD",
        "EDEADLK",
        "EDOM",
        "EEXIST",
        "EFAULT",
        "EFBIG",
        "EINTR",
        "EINVAL",
        "EIO",
        "EISDIR",
        "EMFILE",
        "EMLINK",
        "ENAMETOOLONG",
        "ENFILE",
        "ENODEV",
        "ENOENT",
        "ENOEXEC",
        "ENOLCK",
        "ENOMEM",
        "ENOSPC",
        "ENOSYS",
        "ENOTDIR",
        "ENOTEMPTY",
        "ENOTTY",
        "ENXIO",
        "EPERM",
        "EPIPE",
        "ERANGE",
        "EROFS",
        "ESPIPE",
        "ESRCH",
        "EXDEV",
        "EWOULDBLOCK",
        "EINPROGRESS",
        "EALREADY",
        "ENOTSOCK",
        "EDESTADDRREQ",
        "EMSGSIZE",
        "EPROTOTYPE",
        "ENOPROTOOPT",
        "EPROTONOSUPPORT",
        "ESOCKTNOSUPPORT",
        "EOPNOTSUPP",
        "EPFNOSUPPORT",
        "EAFNOSUPPORT",
        "EADDRINUSE",
        "EADDRNOTAVAIL",
        "ENETDOWN",
        "ENETUNREACH",
        "ENETRESET",
        "ECONNABORTED",
        "ECONNRESET",
        "ENOBUFS",
        "EISCONN",
        "ENOTCONN",
        "ESHUTDOWN",
        "ETOOMANYREFS",
        "ETIMEDOUT",
        "ECONNREFUSED",
        "EHOSTDOWN",
        "EHOSTUNREACH",
        "ELOOP",
        "EOVERFLOW"];
    function caml_strerror(errno){
     if(typeof require === "undefined"){
      const code = unix_error[errno];
      return code || "Unknown error " + errno;
     }
     const util = require("node:util");
     if(errno >= 0){
      const code = unix_error[errno];
      for(const e of util.getSystemErrorMap())
       if(e[1][0] === code) return e[1][1];
      return code || "Unknown error " + errno;
     }
     else
      return util.getSystemErrorMessage(errno);
    }
    var caml_gr_state;
    function caml_gr_y(s, y){return s.height - 1 - y;}
    function gr_blit_image_for_wasm(im, x, y){
     var
      s = caml_gr_state,
      im2 =
        s.context.getImageData
         (x, caml_gr_y(s, y) - im.height + 1, im.width, im.height);
     for(var i = 0; i < im2.data.length; i += 4){
      im.data[i] = im2.data[i];
      im.data[i + 1] = im2.data[i + 1];
      im.data[i + 2] = im2.data[i + 2];
      im.data[i + 3] = im2.data[i + 3];
     }
    }
    function gr_clear_for_wasm(){
     var s = caml_gr_state;
     s.context.clearRect(0, 0, s.canvas.width, s.canvas.height);
    }
    function gr_close_for_wasm(){
     caml_gr_state.canvas.width = 0;
     caml_gr_state.canvas.height = 0;
    }
    function gr_create_image_for_wasm(x, y){
     return caml_gr_state.context.createImageData(x, y);
    }
    function gr_current_x_for_wasm(){return caml_gr_state.x;}
    function gr_current_y_for_wasm(){return caml_gr_state.y;}
    function gr_doc_of_state_for_wasm(state){
     if(state.canvas.ownerDocument) return state.canvas.ownerDocument;
     return null;
    }
    function caml_gr_arc_aux(ctx, cx, cy, ry, rx, a1, a2){
     while(a1 > a2) a2 += 360;
     a1 /= 180;
     a2 /= 180;
     var
      rot = 0,
      xPos,
      yPos,
      xPos_prev,
      yPos_prev,
      space = 2,
      num = (a2 - a1) * Math.PI * ((rx + ry) / 2) / space | 0,
      delta = (a2 - a1) * Math.PI / num,
      i = - a1 * Math.PI;
     for(var j = 0; j <= num; j++){
      xPos =
       cx - rx * Math.sin(i) * Math.sin(rot * Math.PI)
       + ry * Math.cos(i) * Math.cos(rot * Math.PI);
      xPos = xPos.toFixed(2);
      yPos =
       cy + ry * Math.cos(i) * Math.sin(rot * Math.PI)
       + rx * Math.sin(i) * Math.cos(rot * Math.PI);
      yPos = yPos.toFixed(2);
      if(j === 0)
       ctx.moveTo(xPos, yPos);
      else if(xPos_prev !== xPos || yPos_prev !== yPos)
       ctx.lineTo(xPos, yPos);
      xPos_prev = xPos;
      yPos_prev = yPos;
      i -= delta;
     }
     return 0;
    }
    function caml_gr_xc(x){return x + 0.5;}
    function caml_gr_yc(s, y){return caml_gr_y(s, y) + 0.5;}
    function gr_draw_arc_for_wasm(x, y, rx, ry, a1, a2){
     var s = caml_gr_state;
     s.context.beginPath();
     caml_gr_arc_aux
      (s.context, caml_gr_xc(x), caml_gr_yc(s, y), rx, ry, a1, a2);
     s.context.stroke();
    }
    function gr_draw_str_for_wasm(str){
     var s = caml_gr_state, m = s.context.measureText(str), dx = m.width;
     s.context.fillText(str, s.x, caml_gr_y(s, s.y) + 1);
     s.x += dx | 0;
    }
    function gr_draw_char_for_wasm(c){
     gr_draw_str_for_wasm(String.fromCharCode(c));
    }
    function gr_draw_image_for_wasm(im, x, y){
     var s = caml_gr_state;
     if(! im.image){
      var canvas = document.createElement("canvas");
      canvas.width = s.width;
      canvas.height = s.height;
      canvas.getContext("2d").putImageData(im, 0, 0);
      im.image = canvas;
     }
     s.context.drawImage(im.image, x, caml_gr_y(s, y) - im.height + 1);
    }
    function gr_draw_rect_for_wasm(x, y, w, h){
     var
      s = caml_gr_state,
      x0 = caml_gr_xc(x),
      y0 = caml_gr_yc(s, y),
      x1 = caml_gr_xc(x + w),
      y1 = caml_gr_yc(s, y + h);
     s.context.beginPath();
     s.context.moveTo(x0, y0);
     s.context.lineTo(x1, y0);
     s.context.lineTo(x1, y1);
     s.context.lineTo(x0, y1);
     s.context.lineTo(x0, y0);
     s.context.stroke();
    }
    function gr_dump_image_height_for_wasm(im){return im.height;}
    function gr_dump_image_pixel_for_wasm(im, i, j){
     var o = i * (im.width * 4) + j * 4;
     return (im.data[o] << 16) + (im.data[o + 1] << 8) + im.data[o + 2];
    }
    function gr_dump_image_width_for_wasm(im){return im.width;}
    function gr_fill_arc_for_wasm(x, y, rx, ry, a1, a2){
     var s = caml_gr_state, cx = caml_gr_xc(x), cy = caml_gr_yc(s, y);
     s.context.beginPath();
     caml_gr_arc_aux(s.context, cx, cy, rx, ry, a1, a2);
     s.context.lineTo(cx, cy);
     s.context.fill();
    }
    function gr_fill_poly_for_wasm(ar, n){
     var s = caml_gr_state;
     s.context.beginPath();
     s.context.moveTo(ar[0], caml_gr_y(s, ar[1]));
     for(var i = 1; i < n; i++)
      s.context.lineTo(ar[i * 2], caml_gr_y(s, ar[i * 2 + 1]));
     s.context.lineTo(ar[0], caml_gr_y(s, ar[1]));
     s.context.fill();
    }
    function gr_fill_rect_for_wasm(x, y, w, h){
     var s = caml_gr_state;
     s.context.fillRect(x, caml_gr_y(s, y) - h, w + 1, h + 1);
    }
    function gr_lineto_for_wasm(x, y){
     var s = caml_gr_state;
     s.context.beginPath();
     s.context.moveTo(caml_gr_xc(s.x), caml_gr_yc(s, s.y));
     s.context.lineTo(caml_gr_xc(x), caml_gr_yc(s, y));
     s.context.stroke();
     s.x = x;
     s.y = y;
    }
    function gr_make_image_for_wasm(pixels, w, h){
     var s = caml_gr_state, im = s.context.createImageData(w, h);
     for(var i = 0; i < h; i++)
      for(var j = 0; j < w; j++){
       var c = pixels[i * w + j], o = i * (w * 4) + j * 4;
       if(c === - 1){
        im.data[o + 0] = 0;
        im.data[o + 1] = 0;
        im.data[o + 2] = 0;
        im.data[o + 3] = 0;
       }
       else{
        im.data[o + 0] = c >> 16 & 0xff;
        im.data[o + 1] = c >> 8 & 0xff;
        im.data[o + 2] = c >> 0 & 0xff;
        im.data[o + 3] = 0xff;
       }
      }
     return im;
    }
    function gr_moveto_for_wasm(x, y){
     caml_gr_state.x = x;
     caml_gr_state.y = y;
    }
    function gr_state_create_for_wasm(canvas, w, h){
     var context = canvas.getContext("2d");
     context.lineCap = "round";
     context.lineJoin = "round";
     return {context: context,
             canvas: canvas,
             x: 0,
             y: 0,
             width: w,
             height: h,
             line_width: 1,
             font: "fixed",
             text_size: 26,
             color: 0x000000,
             title: ""};
    }
    function gr_set_font_for_wasm(f){
     var s = caml_gr_state;
     s.font = f;
     s.context.font = s.text_size + "px " + f;
    }
    function gr_set_window_title_for_wasm(name){
     var s = caml_gr_state;
     s.title = name;
     if(s.set_title) s.set_title(name);
    }
    function gr_set_line_width_for_wasm(w){
     caml_gr_state.line_width = w;
     caml_gr_state.context.lineWidth = w;
     caml_gr_state.context.lineCap = "round";
     caml_gr_state.context.lineJoin = "round";
    }
    function gr_set_text_size_for_wasm(size){
     var s = caml_gr_state;
     s.text_size = size;
     s.context.font = s.text_size + "px " + s.font;
    }
    function gr_set_color_for_wasm(color){
     var s = caml_gr_state;
     function convert(number){
      var str = "" + number.toString(16);
      while(str.length < 2) str = "0" + str;
      return str;
     }
     var r = color >> 16 & 0xff, g = color >> 8 & 0xff, b = color >> 0 & 0xff;
     s.color = color;
     var c_str = "#" + convert(r) + convert(g) + convert(b);
     s.context.fillStyle = c_str;
     s.context.strokeStyle = c_str;
    }
    function gr_resize_window_for_wasm(w, h){
     var s = caml_gr_state;
     s.width = w;
     s.height = h;
     if(w !== s.canvas.width) s.canvas.width = w;
     if(h !== s.canvas.height) s.canvas.height = h;
    }
    function gr_state_init_for_wasm(){
     var s = caml_gr_state;
     gr_moveto_for_wasm(s.x, s.y);
     gr_resize_window_for_wasm(s.width, s.height);
     gr_set_line_width_for_wasm(s.line_width);
     gr_set_text_size_for_wasm(s.text_size);
     gr_set_font_for_wasm(s.font);
     gr_set_color_for_wasm(s.color);
     gr_set_window_title_for_wasm(s.title);
     s.context.textBaseline = "bottom";
    }
    function gr_state_set_for_wasm(ctx){
     caml_gr_state = ctx;
     gr_state_init_for_wasm();
    }
    function gr_open_for_wasm(info){
     function get(name){
      var res = info.match("(^|,) *" + name + " *= *([a-zA-Z0-9_]+) *(,|$)");
      if(res) return res[2];
     }
     var specs = [];
     if(! (info === "")) specs.push(info);
     var target = get("target");
     if(! target) target = "";
     var status = get("status");
     if(! status) specs.push("status=1");
     var w = get("width");
     w = w ? Number.parseInt(w) : 200;
     specs.push("width=" + w);
     var h = get("height");
     h = h ? Number.parseInt(h) : 200;
     specs.push("height=" + h);
     var win = globalThis.open("about:blank", target, specs.join(","));
     if(! win) return - 1;
     var doc = win.document, canvas = doc.createElement("canvas");
     canvas.width = w;
     canvas.height = h;
     var ctx = gr_state_create_for_wasm(canvas, w, h);
     ctx.set_title = function(title){doc.title = title;};
     gr_state_set_for_wasm(ctx);
     var body = doc.body;
     body.style.margin = "0px";
     body.appendChild(canvas);
     return 0;
    }
    function gr_plot_for_wasm(x, y){
     var
      s = caml_gr_state,
      im = s.context.createImageData(1, 1),
      d = im.data,
      color = s.color;
     d[0] = color >> 16 & 0xff;
     d[1] = color >> 8 & 0xff;
     d[2] = color >> 0 & 0xff;
     d[3] = 0xff;
     s.x = x;
     s.y = y;
     s.context.putImageData(im, x, caml_gr_y(s, y));
    }
    function gr_point_color_for_wasm(x, y){
     var
      s = caml_gr_state,
      im = s.context.getImageData(x, caml_gr_y(s, y), 1, 1),
      d = im.data;
     return (d[0] << 16) + (d[1] << 8) + d[2];
    }
    function gr_size_x_for_wasm(){return caml_gr_state.width;}
    function gr_size_y_for_wasm(){return caml_gr_state.height;}
    function gr_state_for_wasm(){
     if(caml_gr_state) return caml_gr_state;
     return null;
    }
    function gr_text_size_h_for_wasm(){return caml_gr_state.text_size;}
    function gr_text_size_w_for_wasm(txt){
     return caml_gr_state.context.measureText(txt).width | 0;
    }
    return {unix_error: unix_error,
            gr_text_size_w_for_wasm: gr_text_size_w_for_wasm,
            gr_text_size_h_for_wasm: gr_text_size_h_for_wasm,
            gr_state_set_for_wasm: gr_state_set_for_wasm,
            gr_state_for_wasm: gr_state_for_wasm,
            gr_state_create_for_wasm: gr_state_create_for_wasm,
            gr_size_y_for_wasm: gr_size_y_for_wasm,
            gr_size_x_for_wasm: gr_size_x_for_wasm,
            gr_set_window_title_for_wasm: gr_set_window_title_for_wasm,
            gr_set_text_size_for_wasm: gr_set_text_size_for_wasm,
            gr_set_line_width_for_wasm: gr_set_line_width_for_wasm,
            gr_set_font_for_wasm: gr_set_font_for_wasm,
            gr_set_color_for_wasm: gr_set_color_for_wasm,
            gr_resize_window_for_wasm: gr_resize_window_for_wasm,
            gr_point_color_for_wasm: gr_point_color_for_wasm,
            gr_plot_for_wasm: gr_plot_for_wasm,
            gr_open_for_wasm: gr_open_for_wasm,
            gr_moveto_for_wasm: gr_moveto_for_wasm,
            gr_make_image_for_wasm: gr_make_image_for_wasm,
            gr_lineto_for_wasm: gr_lineto_for_wasm,
            gr_fill_rect_for_wasm: gr_fill_rect_for_wasm,
            gr_fill_poly_for_wasm: gr_fill_poly_for_wasm,
            gr_fill_arc_for_wasm: gr_fill_arc_for_wasm,
            gr_dump_image_width_for_wasm: gr_dump_image_width_for_wasm,
            gr_dump_image_pixel_for_wasm: gr_dump_image_pixel_for_wasm,
            gr_dump_image_height_for_wasm: gr_dump_image_height_for_wasm,
            gr_draw_str_for_wasm: gr_draw_str_for_wasm,
            gr_draw_rect_for_wasm: gr_draw_rect_for_wasm,
            gr_draw_image_for_wasm: gr_draw_image_for_wasm,
            gr_draw_char_for_wasm: gr_draw_char_for_wasm,
            gr_draw_arc_for_wasm: gr_draw_arc_for_wasm,
            gr_doc_of_state_for_wasm: gr_doc_of_state_for_wasm,
            gr_current_y_for_wasm: gr_current_y_for_wasm,
            gr_current_x_for_wasm: gr_current_x_for_wasm,
            gr_create_image_for_wasm: gr_create_image_for_wasm,
            gr_close_for_wasm: gr_close_for_wasm,
            gr_clear_for_wasm: gr_clear_for_wasm,
            gr_blit_image_for_wasm: gr_blit_image_for_wasm,
            caml_strerror: caml_strerror,
            caml_jsoo_promise_wrap: caml_jsoo_promise_wrap,
            caml_jsoo_promise_unwrap: caml_jsoo_promise_unwrap,
            caml_js_html_entities: caml_js_html_entities};
   }
   (globalThis))
({"link":[["runtime-5f0b7fcf",0],["prelude-c15013c5",0],["stdlib-18e7782c",[]],["dune__exe__Main-43bee804",[]],["std_exit-e488974c",[2]],["_link_info",0],["start-92196935",0]],"generated":(a=>{var
b=a,c=a?.module?.export||a;return{"Jstr.fragments":{"fun_call_0":a=>a(),"get_Number":a=>a.Number,"get_String":a=>a.String,"get_done":a=>a.done,"get_length":a=>a.length,"get_value":a=>a.value,"js_expr_12c48ca8":()=>a,"js_expr_7571e1f":()=>Symbol.iterator,"meth_call_0_next":a=>a.next(),"meth_call_0_toLowerCase":a=>a.toLowerCase(),"meth_call_0_toString":a=>a.toString(),"meth_call_0_toUpperCase":a=>a.toUpperCase(),"meth_call_0_trim":a=>a.trim(),"meth_call_1_codePointAt":(a,b)=>a.codePointAt(b),"meth_call_1_concat":(a,b)=>a.concat(b),"meth_call_1_endsWith":(a,b)=>a.endsWith(b),"meth_call_1_fromCodePoint":(a,b)=>a.fromCodePoint(b),"meth_call_1_includes":(a,b)=>a.includes(b),"meth_call_1_join":(a,b)=>a.join(b),"meth_call_1_normalize":(a,b)=>a.normalize(b),"meth_call_1_parseFloat":(a,b)=>a.parseFloat(b),"meth_call_1_repeat":(a,b)=>a.repeat(b),"meth_call_1_split":(a,b)=>a.split(b),"meth_call_1_startsWith":(a,b)=>a.startsWith(b),"meth_call_1_toFixed":(a,b)=>a.toFixed(b),"meth_call_1_toString":(a,b)=>a.toString(b),"meth_call_2_indexOf":(a,b,c)=>a.indexOf(b,c),"meth_call_2_lastIndexOf":(a,b,c)=>a.lastIndexOf(b,c),"meth_call_2_padEnd":(a,b,c)=>a.padEnd(b,c),"meth_call_2_padStart":(a,b,c)=>a.padStart(b,c)},"Jv.fragments":{"fun_call_0":a=>a(),"fun_call_1":(a,b)=>a(b),"get_Array":a=>a.Array,"get_Error":a=>a.Error,"get_Promise":a=>a.Promise,"get_done":a=>a.done,"get_length":a=>a.length,"get_message":a=>a.message,"get_name":a=>a.name,"get_stack":a=>a.stack,"get_value":a=>a.value,"js_expr_12c48ca8":()=>a,"js_expr_26f07992":()=>null,"js_expr_28647a4c":()=>!1,"js_expr_2d7ff750":()=>function(a){throw a},"js_expr_34edcf72":()=>!0,"js_expr_7571e1f":()=>Symbol.iterator,"js_expr_ba692c1":()=>undefined,"meth_call_0_next":a=>a.next(),"meth_call_1_all":(a,b)=>a.all(b),"meth_call_1_isArray":(a,b)=>a.isArray(b),"meth_call_1_reject":(a,b)=>a.reject(b),"meth_call_1_resolve":(a,b)=>a.resolve(b),"meth_call_1_then":(a,b)=>a.then(b),"meth_call_2_then":(a,b,c)=>a.then(b,c),"new_1":(a,b)=>new
a(b),"set_name":(a,b)=>a.name=b},"Fut.fragments":{"fun_call_2":(a,b,c)=>a(b,c),"get_fut":a=>a.fut,"get_setTimeout":a=>a.setTimeout,"obj_0":a=>({fut:a}),"obj_1":a=>({fut:a}),"obj_2":a=>({fut:a}),"obj_3":a=>({fut:a}),"obj_4":a=>({fut:a}),"obj_5":a=>({fut:a}),"obj_6":a=>({fut:a})},"Brr.fragments":{"fun_call_1":(a,b)=>a(b),"get_AbortController":a=>a.AbortController,"get_ArrayBuffer":a=>a.ArrayBuffer,"get_Blob":a=>a.Blob,"get_DataView":a=>a.DataView,"get_Event":a=>a.Event,"get_File":a=>a.File,"get_FileReader":a=>a.FileReader,"get_Float32Array":a=>a.Float32Array,"get_Float64Array":a=>a.Float64Array,"get_Int16Array":a=>a.Int16Array,"get_Int32Array":a=>a.Int32Array,"get_Int8Array":a=>a.Int8Array,"get_JSON":a=>a.JSON,"get_Object":a=>a.Object,"get_Range":a=>a.Range,"get_RegExp":a=>a.RegExp,"get_String":a=>a.String,"get_TextDecoder":a=>a.TextDecoder,"get_TextEncoder":a=>a.TextEncoder,"get_URL":a=>a.URL,"get_URLSearchParams":a=>a.URLSearchParams,"get_Uint16Array":a=>a.Uint16Array,"get_Uint32Array":a=>a.Uint32Array,"get_Uint8Array":a=>a.Uint8Array,"get_Uint8ClampedArray":a=>a.Uint8ClampedArray,"get_activeElement":a=>a.activeElement,"get_atob":a=>a.atob,"get_body":a=>a.body,"get_btoa":a=>a.btoa,"get_buffer":a=>a.buffer,"get_childNodes":a=>a.childNodes,"get_children":a=>a.children,"get_classList":a=>a.classList,"get_commonAncestorContainer":a=>a.commonAncestorContainer,"get_console":a=>a.console,"get_constructor":a=>a.constructor,"get_currentTarget":a=>a.currentTarget,"get_decodeURI":a=>a.decodeURI,"get_decodeURIComponent":a=>a.decodeURIComponent,"get_document":a=>a.document,"get_documentElement":a=>a.documentElement,"get_encodeURI":a=>a.encodeURI,"get_encodeURIComponent":a=>a.encodeURIComponent,"get_endContainer":a=>a.endContainer,"get_error":a=>a.error,"get_firstChild":a=>a.firstChild,"get_fullscreenElement":a=>a.fullscreenElement,"get_head":a=>a.head,"get_history":a=>a.history,"get_items":a=>a.items,"get_location":a=>a.location,"get_maxTouchPoints":a=>a.maxTouchPoints,"get_navigator":a=>a.navigator,"get_offsetParent":a=>a.offsetParent,"get_ownerDocument":a=>a.ownerDocument,"get_parent":a=>a.parent,"get_performance":a=>a.performance,"get_pointerLockElement":a=>a.pointerLockElement,"get_result":a=>a.result,"get_signal":a=>a.signal,"get_startContainer":a=>a.startContainer,"get_state":a=>a.state,"get_stream":a=>a.stream,"get_style":a=>a.style,"get_target":a=>a.target,"get_window":a=>a.window,"meth_call_0_abort":a=>a.abort(),"meth_call_0_arrayBuffer":a=>a.arrayBuffer(),"meth_call_0_back":a=>a.back(),"meth_call_0_blur":a=>a.blur(),"meth_call_0_clear":a=>a.clear(),"meth_call_0_clearResourceTimings":a=>a.clearResourceTimings(),"meth_call_0_click":a=>a.click(),"meth_call_0_cloneRange":a=>a.cloneRange(),"meth_call_0_close":a=>a.close(),"meth_call_0_composedPath":a=>a.composedPath(),"meth_call_0_deleteContents":a=>a.deleteContents(),"meth_call_0_entries":a=>a.entries(),"meth_call_0_exitFullscreen":a=>a.exitFullscreen(),"meth_call_0_exitPointerLock":a=>a.exitPointerLock(),"meth_call_0_focus":a=>a.focus(),"meth_call_0_forward":a=>a.forward(),"meth_call_0_getAsFile":a=>a.getAsFile(),"meth_call_0_getBoundingClientRect":a=>a.getBoundingClientRect(),"meth_call_0_getCoalescedEvents":a=>a.getCoalescedEvents(),"meth_call_0_getEntries":a=>a.getEntries(),"meth_call_0_getPredictedEvents":a=>a.getPredictedEvents(),"meth_call_0_measure":a=>a.measure(),"meth_call_0_now":a=>a.now(),"meth_call_0_preventDefault":a=>a.preventDefault(),"meth_call_0_print":a=>a.print(),"meth_call_0_reload":a=>a.reload(),"meth_call_0_requestPointerLock":a=>a.requestPointerLock(),"meth_call_0_reverse":a=>a.reverse(),"meth_call_0_select":a=>a.select(),"meth_call_0_stopImmediatePropagation":a=>a.stopImmediatePropagation(),"meth_call_0_stopPropagation":a=>a.stopPropagation(),"meth_call_0_text":a=>a.text(),"meth_call_0_toJSON":a=>a.toJSON(),"meth_call_0_toString":a=>a.toString(),"meth_call_1_add":(a,b)=>a.add(b),"meth_call_1_appendChild":(a,b)=>a.appendChild(b),"meth_call_1_cancelAnimationFrame":(a,b)=>a.cancelAnimationFrame(b),"meth_call_1_charCodeAt":(a,b)=>a.charCodeAt(b),"meth_call_1_clearTimeout":(a,b)=>a.clearTimeout(b),"meth_call_1_collapse":(a,b)=>a.collapse(b),"meth_call_1_contains":(a,b)=>a.contains(b),"meth_call_1_createElement":(a,b)=>a.createElement(b),"meth_call_1_createTextNode":(a,b)=>a.createTextNode(b),"meth_call_1_decode":(a,b)=>a.decode(b),"meth_call_1_dispatchEvent":(a,b)=>a.dispatchEvent(b),"meth_call_1_encode":(a,b)=>a.encode(b),"meth_call_1_entries":(a,b)=>a.entries(b),"meth_call_1_escape":(a,b)=>a.escape(b),"meth_call_1_every":(a,b)=>a.every(b),"meth_call_1_exec":(a,b)=>a.exec(b),"meth_call_1_filter":(a,b)=>a.filter(b),"meth_call_1_find":(a,b)=>a.find(b),"meth_call_1_findIndex":(a,b)=>a.findIndex(b),"meth_call_1_forEach":(a,b)=>a.forEach(b),"meth_call_1_fromCharCode":(a,b)=>a.fromCharCode(b),"meth_call_1_get":(a,b)=>a.get(b),"meth_call_1_getAll":(a,b)=>a.getAll(b),"meth_call_1_getAsString":(a,b)=>a.getAsString(b),"meth_call_1_getAttribute":(a,b)=>a.getAttribute(b),"meth_call_1_getComputedStyle":(a,b)=>a.getComputedStyle(b),"meth_call_1_getElementById":(a,b)=>a.getElementById(b),"meth_call_1_getElementsByClassName":(a,b)=>a.getElementsByClassName(b),"meth_call_1_getElementsByName":(a,b)=>a.getElementsByName(b),"meth_call_1_getElementsByTagName":(a,b)=>a.getElementsByTagName(b),"meth_call_1_getEntriesByName":(a,b)=>a.getEntriesByName(b),"meth_call_1_getEntriesByType":(a,b)=>a.getEntriesByType(b),"meth_call_1_getFloat32":(a,b)=>a.getFloat32(b),"meth_call_1_getFloat64":(a,b)=>a.getFloat64(b),"meth_call_1_getInt16":(a,b)=>a.getInt16(b),"meth_call_1_getInt32":(a,b)=>a.getInt32(b),"meth_call_1_getInt8":(a,b)=>a.getInt8(b),"meth_call_1_getModifierState":(a,b)=>a.getModifierState(b),"meth_call_1_getUint16":(a,b)=>a.getUint16(b),"meth_call_1_getUint32":(a,b)=>a.getUint32(b),"meth_call_1_getUint8":(a,b)=>a.getUint8(b),"meth_call_1_go":(a,b)=>a.go(b),"meth_call_1_has":(a,b)=>a.has(b),"meth_call_1_insertNode":(a,b)=>a.insertNode(b),"meth_call_1_intersectsNode":(a,b)=>a.intersectsNode(b),"meth_call_1_join":(a,b)=>a.join(b),"meth_call_1_map":(a,b)=>a.map(b),"meth_call_1_mark":(a,b)=>a.mark(b),"meth_call_1_match":(a,b)=>a.match(b),"meth_call_1_matchAll":(a,b)=>a.matchAll(b),"meth_call_1_matchMedia":(a,b)=>a.matchMedia(b),"meth_call_1_measure":(a,b)=>a.measure(b),"meth_call_1_parse":(a,b)=>a.parse(b),"meth_call_1_querySelector":(a,b)=>a.querySelector(b),"meth_call_1_querySelectorAll":(a,b)=>a.querySelectorAll(b),"meth_call_1_readAsArrayBuffer":(a,b)=>a.readAsArrayBuffer(b),"meth_call_1_readAsDataURL":(a,b)=>a.readAsDataURL(b),"meth_call_1_readAsText":(a,b)=>a.readAsText(b),"meth_call_1_remove":(a,b)=>a.remove(b),"meth_call_1_removeAttribute":(a,b)=>a.removeAttribute(b),"meth_call_1_removeChild":(a,b)=>a.removeChild(b),"meth_call_1_removeProperty":(a,b)=>a.removeProperty(b),"meth_call_1_requestAnimationFrame":(a,b)=>a.requestAnimationFrame(b),"meth_call_1_requestFullscreen":(a,b)=>a.requestFullscreen(b),"meth_call_1_scrollIntoView":(a,b)=>a.scrollIntoView(b),"meth_call_1_search":(a,b)=>a.search(b),"meth_call_1_selectNode":(a,b)=>a.selectNode(b),"meth_call_1_selectNodeContents":(a,b)=>a.selectNodeContents(b),"meth_call_1_setEndAfter":(a,b)=>a.setEndAfter(b),"meth_call_1_setEndBefore":(a,b)=>a.setEndBefore(b),"meth_call_1_setStartAfter":(a,b)=>a.setStartAfter(b),"meth_call_1_setStartBefore":(a,b)=>a.setStartBefore(b),"meth_call_1_split":(a,b)=>a.split(b),"meth_call_1_stringify":(a,b)=>a.stringify(b),"meth_call_1_surroundContents":(a,b)=>a.surroundContents(b),"meth_call_1_test":(a,b)=>a.test(b),"meth_call_1_waitUntil":(a,b)=>a.waitUntil(b),"meth_call_2_add":(a,b,c)=>a.add(b,c),"meth_call_2_append":(a,b,c)=>a.append(b,c),"meth_call_2_compareBoundaryPoints":(a,b,c)=>a.compareBoundaryPoints(b,c),"meth_call_2_comparePoint":(a,b,c)=>a.comparePoint(b,c),"meth_call_2_getEntriesByName":(a,b,c)=>a.getEntriesByName(b,c),"meth_call_2_getFloat32":(a,b,c)=>a.getFloat32(b,c),"meth_call_2_getFloat64":(a,b,c)=>a.getFloat64(b,c),"meth_call_2_getInt16":(a,b,c)=>a.getInt16(b,c),"meth_call_2_getInt32":(a,b,c)=>a.getInt32(b,c),"meth_call_2_getUint16":(a,b,c)=>a.getUint16(b,c),"meth_call_2_getUint32":(a,b,c)=>a.getUint32(b,c),"meth_call_2_isPointInRange":(a,b,c)=>a.isPointInRange(b,c),"meth_call_2_measure":(a,b,c)=>a.measure(b,c),"meth_call_2_reduce":(a,b,c)=>a.reduce(b,c),"meth_call_2_reduceRight":(a,b,c)=>a.reduceRight(b,c),"meth_call_2_replace":(a,b,c)=>a.replace(b,c),"meth_call_2_replaceAll":(a,b,c)=>a.replaceAll(b,c),"meth_call_2_set":(a,b,c)=>a.set(b,c),"meth_call_2_setAttribute":(a,b,c)=>a.setAttribute(b,c),"meth_call_2_setEnd":(a,b,c)=>a.setEnd(b,c),"meth_call_2_setFloat32":(a,b,c)=>a.setFloat32(b,c),"meth_call_2_setFloat64":(a,b,c)=>a.setFloat64(b,c),"meth_call_2_setInt16":(a,b,c)=>a.setInt16(b,c),"meth_call_2_setInt32":(a,b,c)=>a.setInt32(b,c),"meth_call_2_setInt8":(a,b,c)=>a.setInt8(b,c),"meth_call_2_setInterval":(a,b,c)=>a.setInterval(b,c),"meth_call_2_setStart":(a,b,c)=>a.setStart(b,c),"meth_call_2_setTimeout":(a,b,c)=>a.setTimeout(b,c),"meth_call_2_setUint16":(a,b,c)=>a.setUint16(b,c),"meth_call_2_setUint32":(a,b,c)=>a.setUint32(b,c),"meth_call_2_setUint8":(a,b,c)=>a.setUint8(b,c),"meth_call_2_slice":(a,b,c)=>a.slice(b,c),"meth_call_2_split":(a,b,c)=>a.split(b,c),"meth_call_2_subarray":(a,b,c)=>a.subarray(b,c),"meth_call_3_addEventListener":(a,b,c,d)=>a.addEventListener(b,c,d),"meth_call_3_copyWithin":(a,b,c,d)=>a.copyWithin(b,c,d),"meth_call_3_fill":(a,b,c,d)=>a.fill(b,c,d),"meth_call_3_open":(a,b,c,d)=>a.open(b,c,d),"meth_call_3_pushState":(a,b,c,d)=>a.pushState(b,c,d),"meth_call_3_removeEventListener":(a,b,c,d)=>a.removeEventListener(b,c,d),"meth_call_3_replaceState":(a,b,c,d)=>a.replaceState(b,c,d),"meth_call_3_setFloat32":(a,b,c,d)=>a.setFloat32(b,c,d),"meth_call_3_setFloat64":(a,b,c,d)=>a.setFloat64(b,c,d),"meth_call_3_setInt16":(a,b,c,d)=>a.setInt16(b,c,d),"meth_call_3_setInt32":(a,b,c,d)=>a.setInt32(b,c,d),"meth_call_3_setProperty":(a,b,c,d)=>a.setProperty(b,c,d),"meth_call_3_setUint16":(a,b,c,d)=>a.setUint16(b,c,d),"meth_call_3_setUint32":(a,b,c,d)=>a.setUint32(b,c,d),"meth_call_3_slice":(a,b,c,d)=>a.slice(b,c,d),"new_0":a=>new
a(),"new_1":(a,b)=>new
a(b),"new_2":(a,b,c)=>new
a(b,c),"new_3":(a,b,c,d)=>new
a(b,c,d),"obj_10":a=>({fatal:a}),"obj_11":()=>({}),"obj_12":()=>({}),"obj_13":()=>({}),"obj_14":()=>({}),"obj_15":()=>({}),"obj_16":()=>({}),"obj_17":()=>({}),"obj_7":(a,b)=>({block:a,behavior:b}),"obj_8":()=>({}),"obj_9":()=>({}),"set_location":(a,b)=>a.location=b,"set_pathname":(a,b)=>a.pathname=b},"Brr_css.fragments":{"get_CSS":a=>a.CSS,"get_Highlight":a=>a.Highlight,"get_highlights":a=>a.highlights,"meth_call_0_clear":a=>a.clear(),"meth_call_0_entries":a=>a.entries(),"meth_call_1_add":(a,b)=>a.add(b),"meth_call_1_delete":(a,b)=>a.delete(b),"meth_call_1_get":(a,b)=>a.get(b),"meth_call_1_has":(a,b)=>a.has(b),"meth_call_2_set":(a,b,c)=>a.set(b,c),"new_0":a=>new
a()},"Brr_io.fragments":{"fun_call_1":(a,b)=>a(b),"fun_call_2":(a,b,c)=>a(b,c),"get_BroadcastChannel":a=>a.BroadcastChannel,"get_ClipboardItem":a=>a.ClipboardItem,"get_File":a=>a.File,"get_FormData":a=>a.FormData,"get_Headers":a=>a.Headers,"get_MediaRecorder":a=>a.MediaRecorder,"get_MediaStream":a=>a.MediaStream,"get_MessageChannel":a=>a.MessageChannel,"get_Notification":a=>a.Notification,"get_Object":a=>a.Object,"get_Request":a=>a.Request,"get_Response":a=>a.Response,"get_URLSearchParams":a=>a.URLSearchParams,"get_WebSocket":a=>a.WebSocket,"get_actions":a=>a.actions,"get_audioTracks":a=>a.audioTracks,"get_body":a=>a.body,"get_buffered":a=>a.buffered,"get_caches":a=>a.caches,"get_clipboard":a=>a.clipboard,"get_coords":a=>a.coords,"get_data":a=>a.data,"get_error":a=>a.error,"get_fetch":a=>a.fetch,"get_formData":a=>a.formData,"get_geolocation":a=>a.geolocation,"get_handled":a=>a.handled,"get_headers":a=>a.headers,"get_localStorage":a=>a.localStorage,"get_mediaDevices":a=>a.mediaDevices,"get_notification":a=>a.notification,"get_played":a=>a.played,"get_port1":a=>a.port1,"get_port2":a=>a.port2,"get_ports":a=>a.ports,"get_preloadResponse":a=>a.preloadResponse,"get_request":a=>a.request,"get_seekable":a=>a.seekable,"get_sessionStorage":a=>a.sessionStorage,"get_signal":a=>a.signal,"get_source":a=>a.source,"get_srcObject":a=>a.srcObject,"get_stream":a=>a.stream,"get_submitter":a=>a.submitter,"get_textTracks":a=>a.textTracks,"get_track":a=>a.track,"get_types":a=>a.types,"get_videoTracks":a=>a.videoTracks,"meth_call_0_arrayBuffer":a=>a.arrayBuffer(),"meth_call_0_blob":a=>a.blob(),"meth_call_0_captureStream":a=>a.captureStream(),"meth_call_0_checkValidity":a=>a.checkValidity(),"meth_call_0_clear":a=>a.clear(),"meth_call_0_clone":a=>a.clone(),"meth_call_0_close":a=>a.close(),"meth_call_0_entries":a=>a.entries(),"meth_call_0_enumerateDevices":a=>a.enumerateDevices(),"meth_call_0_error":a=>a.error(),"meth_call_0_formData":a=>a.formData(),"meth_call_0_getAudioTracks":a=>a.getAudioTracks(),"meth_call_0_getCapabilities":a=>a.getCapabilities(),"meth_call_0_getConstraints":a=>a.getConstraints(),"meth_call_0_getSettings":a=>a.getSettings(),"meth_call_0_getSupportedConstraints":a=>a.getSupportedConstraints(),"meth_call_0_getTracks":a=>a.getTracks(),"meth_call_0_getVideoTracks":a=>a.getVideoTracks(),"meth_call_0_json":a=>a.json(),"meth_call_0_keys":a=>a.keys(),"meth_call_0_load":a=>a.load(),"meth_call_0_pause":a=>a.pause(),"meth_call_0_play":a=>a.play(),"meth_call_0_read":a=>a.read(),"meth_call_0_readText":a=>a.readText(),"meth_call_0_reportValidity":a=>a.reportValidity(),"meth_call_0_requestData":a=>a.requestData(),"meth_call_0_requestPermission":a=>a.requestPermission(),"meth_call_0_reset":a=>a.reset(),"meth_call_0_resume":a=>a.resume(),"meth_call_0_start":a=>a.start(),"meth_call_0_stop":a=>a.stop(),"meth_call_0_submit":a=>a.submit(),"meth_call_0_text":a=>a.text(),"meth_call_0_toJSON":a=>a.toJSON(),"meth_call_1_add":(a,b)=>a.add(b),"meth_call_1_addAll":(a,b)=>a.addAll(b),"meth_call_1_addTrack":(a,b)=>a.addTrack(b),"meth_call_1_canPlayType":(a,b)=>a.canPlayType(b),"meth_call_1_clearWatch":(a,b)=>a.clearWatch(b),"meth_call_1_delete":(a,b)=>a.delete(b),"meth_call_1_end":(a,b)=>a.end(b),"meth_call_1_fastSeek":(a,b)=>a.fastSeek(b),"meth_call_1_get":(a,b)=>a.get(b),"meth_call_1_getAll":(a,b)=>a.getAll(b),"meth_call_1_getDisplayMedia":(a,b)=>a.getDisplayMedia(b),"meth_call_1_getItem":(a,b)=>a.getItem(b),"meth_call_1_getTrackById":(a,b)=>a.getTrackById(b),"meth_call_1_getUserMedia":(a,b)=>a.getUserMedia(b),"meth_call_1_has":(a,b)=>a.has(b),"meth_call_1_isTypeSupported":(a,b)=>a.isTypeSupported(b),"meth_call_1_key":(a,b)=>a.key(b),"meth_call_1_keys":(a,b)=>a.keys(b),"meth_call_1_open":(a,b)=>a.open(b),"meth_call_1_postMessage":(a,b)=>a.postMessage(b),"meth_call_1_removeItem":(a,b)=>a.removeItem(b),"meth_call_1_removeTrack":(a,b)=>a.removeTrack(b),"meth_call_1_respondWith":(a,b)=>a.respondWith(b),"meth_call_1_send":(a,b)=>a.send(b),"meth_call_1_start":(a,b)=>a.start(b),"meth_call_1_write":(a,b)=>a.write(b),"meth_call_1_writeText":(a,b)=>a.writeText(b),"meth_call_2_append":(a,b,c)=>a.append(b,c),"meth_call_2_close":(a,b,c)=>a.close(b,c),"meth_call_2_delete":(a,b,c)=>a.delete(b,c),"meth_call_2_getType":(a,b,c)=>a.getType(b,c),"meth_call_2_keys":(a,b,c)=>a.keys(b,c),"meth_call_2_match":(a,b,c)=>a.match(b,c),"meth_call_2_matchAll":(a,b,c)=>a.matchAll(b,c),"meth_call_2_postMessage":(a,b,c)=>a.postMessage(b,c),"meth_call_2_put":(a,b,c)=>a.put(b,c),"meth_call_2_set":(a,b,c)=>a.set(b,c),"meth_call_2_setItem":(a,b,c)=>a.setItem(b,c),"meth_call_3_append":(a,b,c,d)=>a.append(b,c,d),"meth_call_3_getCurrentPosition":(a,b,c,d)=>a.getCurrentPosition(b,c,d),"meth_call_3_set":(a,b,c,d)=>a.set(b,c,d),"meth_call_3_watchPosition":(a,b,c,d)=>a.watchPosition(b,c,d),"new_0":a=>new
a(),"new_1":(a,b)=>new
a(b),"new_2":(a,b,c)=>new
a(b,c),"obj_18":()=>({}),"obj_19":()=>({}),"obj_20":()=>({}),"obj_21":()=>({}),"obj_22":()=>({}),"obj_23":()=>({}),"obj_24":()=>({}),"obj_25":()=>({}),"obj_26":()=>({}),"obj_27":()=>({}),"obj_28":()=>({}),"obj_29":()=>({}),"obj_30":()=>({}),"obj_31":()=>({}),"obj_32":()=>({}),"obj_33":()=>({}),"obj_34":()=>({}),"obj_35":()=>({}),"obj_36":()=>({}),"obj_37":()=>({}),"obj_38":()=>({}),"obj_39":()=>({}),"set_actions":(a,b)=>a.actions=b,"set_body":(a,b)=>a.body=b,"set_signal":(a,b)=>a.signal=b,"set_srcObject":(a,b)=>a.srcObject=b},"Brr_canvas.fragments":{"get_DOMMatrixReadOnly":a=>a.DOMMatrixReadOnly,"get_DOMPointReadOnly":a=>a.DOMPointReadOnly,"get_ImageData":a=>a.ImageData,"get_Path2D":a=>a.Path2D,"get_WebGL2RenderingContext":a=>a.WebGL2RenderingContext,"get_WebGLRenderingContext":a=>a.WebGLRenderingContext,"get_data":a=>a.data,"get_type":a=>a.type,"meth_call_0_closePath":a=>a.closePath(),"meth_call_0_createBuffer":a=>a.createBuffer(),"meth_call_0_createFramebuffer":a=>a.createFramebuffer(),"meth_call_0_createProgram":a=>a.createProgram(),"meth_call_0_createQuery":a=>a.createQuery(),"meth_call_0_createRenderbuffer":a=>a.createRenderbuffer(),"meth_call_0_createSampler":a=>a.createSampler(),"meth_call_0_createTexture":a=>a.createTexture(),"meth_call_0_createTransformFeedback":a=>a.createTransformFeedback(),"meth_call_0_createVertexArray":a=>a.createVertexArray(),"meth_call_0_endTransformFeedback":a=>a.endTransformFeedback(),"meth_call_0_finish":a=>a.finish(),"meth_call_0_flush":a=>a.flush(),"meth_call_0_getContextAttributes":a=>a.getContextAttributes(),"meth_call_0_getError":a=>a.getError(),"meth_call_0_getLineDash":a=>a.getLineDash(),"meth_call_0_getSupportedExtensions":a=>a.getSupportedExtensions(),"meth_call_0_getTransform":a=>a.getTransform(),"meth_call_0_inverse":a=>a.inverse(),"meth_call_0_pauseTransformFeedback":a=>a.pauseTransformFeedback(),"meth_call_0_resetTransform":a=>a.resetTransform(),"meth_call_0_restore":a=>a.restore(),"meth_call_0_resumeTransformFeedback":a=>a.resumeTransformFeedback(),"meth_call_0_save":a=>a.save(),"meth_call_0_toFloat32Array":a=>a.toFloat32Array(),"meth_call_0_toFloat64Array":a=>a.toFloat64Array(),"meth_call_0_toJSON":a=>a.toJSON(),"meth_call_10_blitFramebuffer":(a,b,c,d,e,f,g,h,i,j,k)=>a.blitFramebuffer(b,c,d,e,f,g,h,i,j,k),"meth_call_10_compressedTexSubImage3D":(a,b,c,d,e,f,g,h,i,j,k)=>a.compressedTexSubImage3D(b,c,d,e,f,g,h,i,j,k),"meth_call_10_texImage2D":(a,b,c,d,e,f,g,h,i,j,k)=>a.texImage2D(b,c,d,e,f,g,h,i,j,k),"meth_call_10_texImage3D":(a,b,c,d,e,f,g,h,i,j,k)=>a.texImage3D(b,c,d,e,f,g,h,i,j,k),"meth_call_10_texSubImage2D":(a,b,c,d,e,f,g,h,i,j,k)=>a.texSubImage2D(b,c,d,e,f,g,h,i,j,k),"meth_call_11_compressedTexSubImage3D":(a,b,c,d,e,f,g,h,i,j,k,l)=>a.compressedTexSubImage3D(b,c,d,e,f,g,h,i,j,k,l),"meth_call_11_texImage3D":(a,b,c,d,e,f,g,h,i,j,k,l)=>a.texImage3D(b,c,d,e,f,g,h,i,j,k,l),"meth_call_11_texSubImage3D":(a,b,c,d,e,f,g,h,i,j,k,l)=>a.texSubImage3D(b,c,d,e,f,g,h,i,j,k,l),"meth_call_1_activeTexture":(a,b)=>a.activeTexture(b),"meth_call_1_beginTransformFeedback":(a,b)=>a.beginTransformFeedback(b),"meth_call_1_bindVertexArray":(a,b)=>a.bindVertexArray(b),"meth_call_1_blendEquation":(a,b)=>a.blendEquation(b),"meth_call_1_checkFramebufferStatus":(a,b)=>a.checkFramebufferStatus(b),"meth_call_1_clear":(a,b)=>a.clear(b),"meth_call_1_clearDepth":(a,b)=>a.clearDepth(b),"meth_call_1_clearStencil":(a,b)=>a.clearStencil(b),"meth_call_1_compileShader":(a,b)=>a.compileShader(b),"meth_call_1_createShader":(a,b)=>a.createShader(b),"meth_call_1_cullFace":(a,b)=>a.cullFace(b),"meth_call_1_deleteBuffer":(a,b)=>a.deleteBuffer(b),"meth_call_1_deleteFramebuffer":(a,b)=>a.deleteFramebuffer(b),"meth_call_1_deleteProgram":(a,b)=>a.deleteProgram(b),"meth_call_1_deleteQuery":(a,b)=>a.deleteQuery(b),"meth_call_1_deleteRenderbuffer":(a,b)=>a.deleteRenderbuffer(b),"meth_call_1_deleteSampler":(a,b)=>a.deleteSampler(b),"meth_call_1_deleteShader":(a,b)=>a.deleteShader(b),"meth_call_1_deleteSync":(a,b)=>a.deleteSync(b),"meth_call_1_deleteTexture":(a,b)=>a.deleteTexture(b),"meth_call_1_deleteTransformFeedback":(a,b)=>a.deleteTransformFeedback(b),"meth_call_1_deleteVertexArray":(a,b)=>a.deleteVertexArray(b),"meth_call_1_depthFunc":(a,b)=>a.depthFunc(b),"meth_call_1_depthMask":(a,b)=>a.depthMask(b),"meth_call_1_disable":(a,b)=>a.disable(b),"meth_call_1_disableVertexAttribArray":(a,b)=>a.disableVertexAttribArray(b),"meth_call_1_drawBuffers":(a,b)=>a.drawBuffers(b),"meth_call_1_enable":(a,b)=>a.enable(b),"meth_call_1_enableVertexAttribArray":(a,b)=>a.enableVertexAttribArray(b),"meth_call_1_endQuery":(a,b)=>a.endQuery(b),"meth_call_1_fromFloat32Array":(a,b)=>a.fromFloat32Array(b),"meth_call_1_fromFloat64Array":(a,b)=>a.fromFloat64Array(b),"meth_call_1_frontFace":(a,b)=>a.frontFace(b),"meth_call_1_generateMipmap":(a,b)=>a.generateMipmap(b),"meth_call_1_getAttachedShaders":(a,b)=>a.getAttachedShaders(b),"meth_call_1_getExtension":(a,b)=>a.getExtension(b),"meth_call_1_getParameter":(a,b)=>a.getParameter(b),"meth_call_1_getProgramInfoLog":(a,b)=>a.getProgramInfoLog(b),"meth_call_1_getShaderInfoLog":(a,b)=>a.getShaderInfoLog(b),"meth_call_1_getShaderSource":(a,b)=>a.getShaderSource(b),"meth_call_1_isBuffer":(a,b)=>a.isBuffer(b),"meth_call_1_isEnabled":(a,b)=>a.isEnabled(b),"meth_call_1_isFramebuffer":(a,b)=>a.isFramebuffer(b),"meth_call_1_isProgram":(a,b)=>a.isProgram(b),"meth_call_1_isQuery":(a,b)=>a.isQuery(b),"meth_call_1_isRenderbuffer":(a,b)=>a.isRenderbuffer(b),"meth_call_1_isSampler":(a,b)=>a.isSampler(b),"meth_call_1_isShader":(a,b)=>a.isShader(b),"meth_call_1_isTexture":(a,b)=>a.isTexture(b),"meth_call_1_isTransformFeedback":(a,b)=>a.isTransformFeedback(b),"meth_call_1_isVertexArray":(a,b)=>a.isVertexArray(b),"meth_call_1_lineWidth":(a,b)=>a.lineWidth(b),"meth_call_1_linkProgram":(a,b)=>a.linkProgram(b),"meth_call_1_matrixTransform":(a,b)=>a.matrixTransform(b),"meth_call_1_measureText":(a,b)=>a.measureText(b),"meth_call_1_multiply":(a,b)=>a.multiply(b),"meth_call_1_readBuffer":(a,b)=>a.readBuffer(b),"meth_call_1_rotate":(a,b)=>a.rotate(b),"meth_call_1_scrollPathIntoView":(a,b)=>a.scrollPathIntoView(b),"meth_call_1_setLineDash":(a,b)=>a.setLineDash(b),"meth_call_1_setTransform":(a,b)=>a.setTransform(b),"meth_call_1_stencilMask":(a,b)=>a.stencilMask(b),"meth_call_1_stroke":(a,b)=>a.stroke(b),"meth_call_1_useProgram":(a,b)=>a.useProgram(b),"meth_call_1_validateProgram":(a,b)=>a.validateProgram(b),"meth_call_2_addColorStop":(a,b,c)=>a.addColorStop(b,c),"meth_call_2_attachShader":(a,b,c)=>a.attachShader(b,c),"meth_call_2_beginQuery":(a,b,c)=>a.beginQuery(b,c),"meth_call_2_bindBuffer":(a,b,c)=>a.bindBuffer(b,c),"meth_call_2_bindFramebuffer":(a,b,c)=>a.bindFramebuffer(b,c),"meth_call_2_bindRenderbuffer":(a,b,c)=>a.bindRenderbuffer(b,c),"meth_call_2_bindSampler":(a,b,c)=>a.bindSampler(b,c),"meth_call_2_bindTexture":(a,b,c)=>a.bindTexture(b,c),"meth_call_2_bindTransformFeedback":(a,b,c)=>a.bindTransformFeedback(b,c),"meth_call_2_blendEquationSeparate":(a,b,c)=>a.blendEquationSeparate(b,c),"meth_call_2_blendFunc":(a,b,c)=>a.blendFunc(b,c),"meth_call_2_clip":(a,b,c)=>a.clip(b,c),"meth_call_2_createPattern":(a,b,c)=>a.createPattern(b,c),"meth_call_2_detachShader":(a,b,c)=>a.detachShader(b,c),"meth_call_2_drawFocusIfNeeded":(a,b,c)=>a.drawFocusIfNeeded(b,c),"meth_call_2_fenceSync":(a,b,c)=>a.fenceSync(b,c),"meth_call_2_fill":(a,b,c)=>a.fill(b,c),"meth_call_2_getActiveAttrib":(a,b,c)=>a.getActiveAttrib(b,c),"meth_call_2_getActiveUniform":(a,b,c)=>a.getActiveUniform(b,c),"meth_call_2_getActiveUniformBlockName":(a,b,c)=>a.getActiveUniformBlockName(b,c),"meth_call_2_getAttribLocation":(a,b,c)=>a.getAttribLocation(b,c),"meth_call_2_getBufferParameter":(a,b,c)=>a.getBufferParameter(b,c),"meth_call_2_getContext":(a,b,c)=>a.getContext(b,c),"meth_call_2_getFragDataLocation":(a,b,c)=>a.getFragDataLocation(b,c),"meth_call_2_getIndexedParameter":(a,b,c)=>a.getIndexedParameter(b,c),"meth_call_2_getProgramParameter":(a,b,c)=>a.getProgramParameter(b,c),"meth_call_2_getQuery":(a,b,c)=>a.getQuery(b,c),"meth_call_2_getQueryParameter":(a,b,c)=>a.getQueryParameter(b,c),"meth_call_2_getRenderbufferParameter":(a,b,c)=>a.getRenderbufferParameter(b,c),"meth_call_2_getSamplerParameter":(a,b,c)=>a.getSamplerParameter(b,c),"meth_call_2_getShaderParameter":(a,b,c)=>a.getShaderParameter(b,c),"meth_call_2_getShaderPrecisionFormat":(a,b,c)=>a.getShaderPrecisionFormat(b,c),"meth_call_2_getSyncParameter":(a,b,c)=>a.getSyncParameter(b,c),"meth_call_2_getTexParameter":(a,b,c)=>a.getTexParameter(b,c),"meth_call_2_getTransformFeedbackVarying":(a,b,c)=>a.getTransformFeedbackVarying(b,c),"meth_call_2_getUniform":(a,b,c)=>a.getUniform(b,c),"meth_call_2_getUniformBlockIndex":(a,b,c)=>a.getUniformBlockIndex(b,c),"meth_call_2_getUniformIndices":(a,b,c)=>a.getUniformIndices(b,c),"meth_call_2_getUniformLocation":(a,b,c)=>a.getUniformLocation(b,c),"meth_call_2_getVertexAttrib":(a,b,c)=>a.getVertexAttrib(b,c),"meth_call_2_getVertexAttribOffset":(a,b,c)=>a.getVertexAttribOffset(b,c),"meth_call_2_hint":(a,b,c)=>a.hint(b,c),"meth_call_2_invalidateFramebuffer":(a,b,c)=>a.invalidateFramebuffer(b,c),"meth_call_2_lineTo":(a,b,c)=>a.lineTo(b,c),"meth_call_2_moveTo":(a,b,c)=>a.moveTo(b,c),"meth_call_2_pixelStorei":(a,b,c)=>a.pixelStorei(b,c),"meth_call_2_polygonOffset":(a,b,c)=>a.polygonOffset(b,c),"meth_call_2_sampleCoverage":(a,b,c)=>a.sampleCoverage(b,c),"meth_call_2_scale":(a,b,c)=>a.scale(b,c),"meth_call_2_shaderSource":(a,b,c)=>a.shaderSource(b,c),"meth_call_2_stencilMaskSeparate":(a,b,c)=>a.stencilMaskSeparate(b,c),"meth_call_2_translate":(a,b,c)=>a.translate(b,c),"meth_call_2_uniform1f":(a,b,c)=>a.uniform1f(b,c),"meth_call_2_uniform1fv":(a,b,c)=>a.uniform1fv(b,c),"meth_call_2_uniform1i":(a,b,c)=>a.uniform1i(b,c),"meth_call_2_uniform1iv":(a,b,c)=>a.uniform1iv(b,c),"meth_call_2_uniform1ui":(a,b,c)=>a.uniform1ui(b,c),"meth_call_2_uniform1uiv":(a,b,c)=>a.uniform1uiv(b,c),"meth_call_2_uniform2fv":(a,b,c)=>a.uniform2fv(b,c),"meth_call_2_uniform2iv":(a,b,c)=>a.uniform2iv(b,c),"meth_call_2_uniform2uiv":(a,b,c)=>a.uniform2uiv(b,c),"meth_call_2_uniform3fv":(a,b,c)=>a.uniform3fv(b,c),"meth_call_2_uniform3iv":(a,b,c)=>a.uniform3iv(b,c),"meth_call_2_uniform3uiv":(a,b,c)=>a.uniform3uiv(b,c),"meth_call_2_uniform4fv":(a,b,c)=>a.uniform4fv(b,c),"meth_call_2_uniform4iv":(a,b,c)=>a.uniform4iv(b,c),"meth_call_2_uniform4uiv":(a,b,c)=>a.uniform4uiv(b,c),"meth_call_2_vertexAttrib1f":(a,b,c)=>a.vertexAttrib1f(b,c),"meth_call_2_vertexAttrib1fv":(a,b,c)=>a.vertexAttrib1fv(b,c),"meth_call_2_vertexAttrib2fv":(a,b,c)=>a.vertexAttrib2fv(b,c),"meth_call_2_vertexAttrib3fv":(a,b,c)=>a.vertexAttrib3fv(b,c),"meth_call_2_vertexAttrib4fv":(a,b,c)=>a.vertexAttrib4fv(b,c),"meth_call_2_vertexAttribDivisor":(a,b,c)=>a.vertexAttribDivisor(b,c),"meth_call_2_vertexAttribI4iv":(a,b,c)=>a.vertexAttribI4iv(b,c),"meth_call_2_vertexAttribI4uiv":(a,b,c)=>a.vertexAttribI4uiv(b,c),"meth_call_3_bindAttribLocation":(a,b,c,d)=>a.bindAttribLocation(b,c,d),"meth_call_3_bindBufferBase":(a,b,c,d)=>a.bindBufferBase(b,c,d),"meth_call_3_bufferData":(a,b,c,d)=>a.bufferData(b,c,d),"meth_call_3_bufferSubData":(a,b,c,d)=>a.bufferSubData(b,c,d),"meth_call_3_clearBufferfv":(a,b,c,d)=>a.clearBufferfv(b,c,d),"meth_call_3_clearBufferiv":(a,b,c,d)=>a.clearBufferiv(b,c,d),"meth_call_3_clearBufferuiv":(a,b,c,d)=>a.clearBufferuiv(b,c,d),"meth_call_3_clientWaitSync":(a,b,c,d)=>a.clientWaitSync(b,c,d),"meth_call_3_createImageData":(a,b,c,d)=>a.createImageData(b,c,d),"meth_call_3_drawArrays":(a,b,c,d)=>a.drawArrays(b,c,d),"meth_call_3_drawImage":(a,b,c,d)=>a.drawImage(b,c,d),"meth_call_3_getActiveUniformBlockParameter":(a,b,c,d)=>a.getActiveUniformBlockParameter(b,c,d),"meth_call_3_getActiveUniforms":(a,b,c,d)=>a.getActiveUniforms(b,c,d),"meth_call_3_getBufferSubData":(a,b,c,d)=>a.getBufferSubData(b,c,d),"meth_call_3_getFramebufferAttachmentParameter":(a,b,c,d)=>a.getFramebufferAttachmentParameter(b,c,d),"meth_call_3_getInternalformatParameter":(a,b,c,d)=>a.getInternalformatParameter(b,c,d),"meth_call_3_isPointInStroke":(a,b,c,d)=>a.isPointInStroke(b,c,d),"meth_call_3_putImageData":(a,b,c,d)=>a.putImageData(b,c,d),"meth_call_3_samplerParameterf":(a,b,c,d)=>a.samplerParameterf(b,c,d),"meth_call_3_samplerParameteri":(a,b,c,d)=>a.samplerParameteri(b,c,d),"meth_call_3_stencilFunc":(a,b,c,d)=>a.stencilFunc(b,c,d),"meth_call_3_stencilOp":(a,b,c,d)=>a.stencilOp(b,c,d),"meth_call_3_texParameterf":(a,b,c,d)=>a.texParameterf(b,c,d),"meth_call_3_texParameteri":(a,b,c,d)=>a.texParameteri(b,c,d),"meth_call_3_transformFeedbackVaryings":(a,b,c,d)=>a.transformFeedbackVaryings(b,c,d),"meth_call_3_uniform2f":(a,b,c,d)=>a.uniform2f(b,c,d),"meth_call_3_uniform2i":(a,b,c,d)=>a.uniform2i(b,c,d),"meth_call_3_uniform2ui":(a,b,c,d)=>a.uniform2ui(b,c,d),"meth_call_3_uniformBlockBinding":(a,b,c,d)=>a.uniformBlockBinding(b,c,d),"meth_call_3_uniformMatrix2fv":(a,b,c,d)=>a.uniformMatrix2fv(b,c,d),"meth_call_3_uniformMatrix2x3fv":(a,b,c,d)=>a.uniformMatrix2x3fv(b,c,d),"meth_call_3_uniformMatrix2x4fv":(a,b,c,d)=>a.uniformMatrix2x4fv(b,c,d),"meth_call_3_uniformMatrix3fv":(a,b,c,d)=>a.uniformMatrix3fv(b,c,d),"meth_call_3_uniformMatrix3x2fv":(a,b,c,d)=>a.uniformMatrix3x2fv(b,c,d),"meth_call_3_uniformMatrix3x4fv":(a,b,c,d)=>a.uniformMatrix3x4fv(b,c,d),"meth_call_3_uniformMatrix4fv":(a,b,c,d)=>a.uniformMatrix4fv(b,c,d),"meth_call_3_uniformMatrix4x2fv":(a,b,c,d)=>a.uniformMatrix4x2fv(b,c,d),"meth_call_3_uniformMatrix4x3fv":(a,b,c,d)=>a.uniformMatrix4x3fv(b,c,d),"meth_call_3_vertexAttrib2f":(a,b,c,d)=>a.vertexAttrib2f(b,c,d),"meth_call_3_waitSync":(a,b,c,d)=>a.waitSync(b,c,d),"meth_call_4_blendColor":(a,b,c,d,e)=>a.blendColor(b,c,d,e),"meth_call_4_blendFuncSeparate":(a,b,c,d,e)=>a.blendFuncSeparate(b,c,d,e),"meth_call_4_clearBufferfi":(a,b,c,d,e)=>a.clearBufferfi(b,c,d,e),"meth_call_4_clearColor":(a,b,c,d,e)=>a.clearColor(b,c,d,e),"meth_call_4_clearRect":(a,b,c,d,e)=>a.clearRect(b,c,d,e),"meth_call_4_colorMask":(a,b,c,d,e)=>a.colorMask(b,c,d,e),"meth_call_4_createLinearGradient":(a,b,c,d,e)=>a.createLinearGradient(b,c,d,e),"meth_call_4_drawArraysInstanced":(a,b,c,d,e)=>a.drawArraysInstanced(b,c,d,e),"meth_call_4_drawElements":(a,b,c,d,e)=>a.drawElements(b,c,d,e),"meth_call_4_fillRect":(a,b,c,d,e)=>a.fillRect(b,c,d,e),"meth_call_4_framebufferRenderbuffer":(a,b,c,d,e)=>a.framebufferRenderbuffer(b,c,d,e),"meth_call_4_isPointInPath":(a,b,c,d,e)=>a.isPointInPath(b,c,d,e),"meth_call_4_quadraticCurveTo":(a,b,c,d,e)=>a.quadraticCurveTo(b,c,d,e),"meth_call_4_rect":(a,b,c,d,e)=>a.rect(b,c,d,e),"meth_call_4_renderbufferStorage":(a,b,c,d,e)=>a.renderbufferStorage(b,c,d,e),"meth_call_4_scissor":(a,b,c,d,e)=>a.scissor(b,c,d,e),"meth_call_4_stencilFuncSeparate":(a,b,c,d,e)=>a.stencilFuncSeparate(b,c,d,e),"meth_call_4_stencilOpSeparate":(a,b,c,d,e)=>a.stencilOpSeparate(b,c,d,e),"meth_call_4_strokeRect":(a,b,c,d,e)=>a.strokeRect(b,c,d,e),"meth_call_4_uniform3f":(a,b,c,d,e)=>a.uniform3f(b,c,d,e),"meth_call_4_uniform3i":(a,b,c,d,e)=>a.uniform3i(b,c,d,e),"meth_call_4_uniform3ui":(a,b,c,d,e)=>a.uniform3ui(b,c,d,e),"meth_call_4_vertexAttrib3f":(a,b,c,d,e)=>a.vertexAttrib3f(b,c,d,e),"meth_call_4_viewport":(a,b,c,d,e)=>a.viewport(b,c,d,e),"meth_call_5_arcTo":(a,b,c,d,e,f)=>a.arcTo(b,c,d,e,f),"meth_call_5_bindBufferRange":(a,b,c,d,e,f)=>a.bindBufferRange(b,c,d,e,f),"meth_call_5_copyBufferSubData":(a,b,c,d,e,f)=>a.copyBufferSubData(b,c,d,e,f),"meth_call_5_drawElementsInstanced":(a,b,c,d,e,f)=>a.drawElementsInstanced(b,c,d,e,f),"meth_call_5_drawImage":(a,b,c,d,e,f)=>a.drawImage(b,c,d,e,f),"meth_call_5_framebufferTexture2D":(a,b,c,d,e,f)=>a.framebufferTexture2D(b,c,d,e,f),"meth_call_5_framebufferTextureLayer":(a,b,c,d,e,f)=>a.framebufferTextureLayer(b,c,d,e,f),"meth_call_5_getImageData":(a,b,c,d,e,f)=>a.getImageData(b,c,d,e,f),"meth_call_5_renderbufferStorageMultisample":(a,b,c,d,e,f)=>a.renderbufferStorageMultisample(b,c,d,e,f),"meth_call_5_texStorage2D":(a,b,c,d,e,f)=>a.texStorage2D(b,c,d,e,f),"meth_call_5_uniform4f":(a,b,c,d,e,f)=>a.uniform4f(b,c,d,e,f),"meth_call_5_uniform4i":(a,b,c,d,e,f)=>a.uniform4i(b,c,d,e,f),"meth_call_5_uniform4ui":(a,b,c,d,e,f)=>a.uniform4ui(b,c,d,e,f),"meth_call_5_vertexAttrib4f":(a,b,c,d,e,f)=>a.vertexAttrib4f(b,c,d,e,f),"meth_call_5_vertexAttribI4i":(a,b,c,d,e,f)=>a.vertexAttribI4i(b,c,d,e,f),"meth_call_5_vertexAttribI4ui":(a,b,c,d,e,f)=>a.vertexAttribI4ui(b,c,d,e,f),"meth_call_5_vertexAttribIPointer":(a,b,c,d,e,f)=>a.vertexAttribIPointer(b,c,d,e,f),"meth_call_6_arc":(a,b,c,d,e,f,g)=>a.arc(b,c,d,e,f,g),"meth_call_6_bezierCurveTo":(a,b,c,d,e,f,g)=>a.bezierCurveTo(b,c,d,e,f,g),"meth_call_6_createRadialGradient":(a,b,c,d,e,f,g)=>a.createRadialGradient(b,c,d,e,f,g),"meth_call_6_drawRangeElements":(a,b,c,d,e,f,g)=>a.drawRangeElements(b,c,d,e,f,g),"meth_call_6_invalidateSubFramebuffer":(a,b,c,d,e,f,g)=>a.invalidateSubFramebuffer(b,c,d,e,f,g),"meth_call_6_setTransform":(a,b,c,d,e,f,g)=>a.setTransform(b,c,d,e,f,g),"meth_call_6_texStorage3D":(a,b,c,d,e,f,g)=>a.texStorage3D(b,c,d,e,f,g),"meth_call_6_transform":(a,b,c,d,e,f,g)=>a.transform(b,c,d,e,f,g),"meth_call_6_vertexAttribPointer":(a,b,c,d,e,f,g)=>a.vertexAttribPointer(b,c,d,e,f,g),"meth_call_7_compressedTexImage2D":(a,b,c,d,e,f,g,h)=>a.compressedTexImage2D(b,c,d,e,f,g,h),"meth_call_7_putImageData":(a,b,c,d,e,f,g,h)=>a.putImageData(b,c,d,e,f,g,h),"meth_call_7_readPixels":(a,b,c,d,e,f,g,h)=>a.readPixels(b,c,d,e,f,g,h),"meth_call_8_compressedTexImage2D":(a,b,c,d,e,f,g,h,i)=>a.compressedTexImage2D(b,c,d,e,f,g,h,i),"meth_call_8_compressedTexImage3D":(a,b,c,d,e,f,g,h,i)=>a.compressedTexImage3D(b,c,d,e,f,g,h,i),"meth_call_8_compressedTexSubImage2D":(a,b,c,d,e,f,g,h,i)=>a.compressedTexSubImage2D(b,c,d,e,f,g,h,i),"meth_call_8_copyTexImage2D":(a,b,c,d,e,f,g,h,i)=>a.copyTexImage2D(b,c,d,e,f,g,h,i),"meth_call_8_copyTexSubImage2D":(a,b,c,d,e,f,g,h,i)=>a.copyTexSubImage2D(b,c,d,e,f,g,h,i),"meth_call_8_ellipse":(a,b,c,d,e,f,g,h,i)=>a.ellipse(b,c,d,e,f,g,h,i),"meth_call_9_compressedTexImage3D":(a,b,c,d,e,f,g,h,i,j)=>a.compressedTexImage3D(b,c,d,e,f,g,h,i,j),"meth_call_9_compressedTexSubImage2D":(a,b,c,d,e,f,g,h,i,j)=>a.compressedTexSubImage2D(b,c,d,e,f,g,h,i,j),"meth_call_9_copyTexSubImage3D":(a,b,c,d,e,f,g,h,i,j)=>a.copyTexSubImage3D(b,c,d,e,f,g,h,i,j),"meth_call_9_drawImage":(a,b,c,d,e,f,g,h,i,j)=>a.drawImage(b,c,d,e,f,g,h,i,j),"meth_call_9_texImage2D":(a,b,c,d,e,f,g,h,i,j)=>a.texImage2D(b,c,d,e,f,g,h,i,j),"meth_call_9_texSubImage2D":(a,b,c,d,e,f,g,h,i,j)=>a.texSubImage2D(b,c,d,e,f,g,h,i,j),"new_0":a=>new
a(),"new_1":(a,b)=>new
a(b),"new_4":(a,b,c,d,e)=>new
a(b,c,d,e),"obj_40":()=>({}),"obj_41":()=>({}),"obj_42":()=>({}),"obj_43":()=>({}),"set_fillStyle":(a,b)=>a.fillStyle=b,"set_strokeStyle":(a,b)=>a.strokeStyle=b},"Brr_webgpu.fragments":{"get_error":a=>a.error,"get_features":a=>a.features,"get_limits":a=>a.limits,"get_lost":a=>a.lost,"get_messages":a=>a.messages,"get_queue":a=>a.queue,"get_wgslLanguageFeatures":a=>a.wgslLanguageFeatures,"meth_call_0_destroy":a=>a.destroy(),"meth_call_0_end":a=>a.end(),"meth_call_0_getCompilationInfo":a=>a.getCompilationInfo(),"meth_call_0_getCurrentTexture":a=>a.getCurrentTexture(),"meth_call_0_getPreferredCanvasFormat":a=>a.getPreferredCanvasFormat(),"meth_call_0_onSubmittedWorkDone":a=>a.onSubmittedWorkDone(),"meth_call_0_popDebugGroup":a=>a.popDebugGroup(),"meth_call_0_popErrorScope":a=>a.popErrorScope(),"meth_call_0_unconfigure":a=>a.unconfigure(),"meth_call_0_unmap":a=>a.unmap(),"meth_call_1_beginComputePass":(a,b)=>a.beginComputePass(b),"meth_call_1_beginRenderPass":(a,b)=>a.beginRenderPass(b),"meth_call_1_configure":(a,b)=>a.configure(b),"meth_call_1_createBindGroup":(a,b)=>a.createBindGroup(b),"meth_call_1_createBindGroupLayout":(a,b)=>a.createBindGroupLayout(b),"meth_call_1_createBuffer":(a,b)=>a.createBuffer(b),"meth_call_1_createCommandEncoder":(a,b)=>a.createCommandEncoder(b),"meth_call_1_createComputePipeline":(a,b)=>a.createComputePipeline(b),"meth_call_1_createComputePipelineAsync":(a,b)=>a.createComputePipelineAsync(b),"meth_call_1_createPipelineLayout":(a,b)=>a.createPipelineLayout(b),"meth_call_1_createQuerySet":(a,b)=>a.createQuerySet(b),"meth_call_1_createRenderBundleEncoder":(a,b)=>a.createRenderBundleEncoder(b),"meth_call_1_createRenderPipeline":(a,b)=>a.createRenderPipeline(b),"meth_call_1_createRenderPipelineAsync":(a,b)=>a.createRenderPipelineAsync(b),"meth_call_1_createSampler":(a,b)=>a.createSampler(b),"meth_call_1_createShaderModule":(a,b)=>a.createShaderModule(b),"meth_call_1_createTexture":(a,b)=>a.createTexture(b),"meth_call_1_createView":(a,b)=>a.createView(b),"meth_call_1_executeBundles":(a,b)=>a.executeBundles(b),"meth_call_1_finish":(a,b)=>a.finish(b),"meth_call_1_getBindGroupLayout":(a,b)=>a.getBindGroupLayout(b),"meth_call_1_getContext":(a,b)=>a.getContext(b),"meth_call_1_has":(a,b)=>a.has(b),"meth_call_1_importExternalTexture":(a,b)=>a.importExternalTexture(b),"meth_call_1_insertDebugMarker":(a,b)=>a.insertDebugMarker(b),"meth_call_1_pushDebugGroup":(a,b)=>a.pushDebugGroup(b),"meth_call_1_pushErrorScope":(a,b)=>a.pushErrorScope(b),"meth_call_1_requestAdapter":(a,b)=>a.requestAdapter(b),"meth_call_1_requestAdapterInfo":(a,b)=>a.requestAdapterInfo(b),"meth_call_1_requestDevice":(a,b)=>a.requestDevice(b),"meth_call_1_setBlendConstant":(a,b)=>a.setBlendConstant(b),"meth_call_1_setPipeline":(a,b)=>a.setPipeline(b),"meth_call_1_setStencilReference":(a,b)=>a.setStencilReference(b),"meth_call_1_submit":(a,b)=>a.submit(b),"meth_call_2_dispatchWorkgroupsIndirect":(a,b,c)=>a.dispatchWorkgroupsIndirect(b,c),"meth_call_2_drawIndexedIndirect":(a,b,c)=>a.drawIndexedIndirect(b,c),"meth_call_2_drawIndirect":(a,b,c)=>a.drawIndirect(b,c),"meth_call_2_getMappedRange":(a,b,c)=>a.getMappedRange(b,c),"meth_call_2_writeTimestamp":(a,b,c)=>a.writeTimestamp(b,c),"meth_call_3_TextureToTexture":(a,b,c,d)=>a.TextureToTexture(b,c,d),"meth_call_3_clearBuffer":(a,b,c,d)=>a.clearBuffer(b,c,d),"meth_call_3_copyBufferToTexture":(a,b,c,d)=>a.copyBufferToTexture(b,c,d),"meth_call_3_copyExternalImageToTexture":(a,b,c,d)=>a.copyExternalImageToTexture(b,c,d),"meth_call_3_copyTextureToBuffer":(a,b,c,d)=>a.copyTextureToBuffer(b,c,d),"meth_call_3_dispatchWorkgroups":(a,b,c,d)=>a.dispatchWorkgroups(b,c,d),"meth_call_3_mapAsync":(a,b,c,d)=>a.mapAsync(b,c,d),"meth_call_3_setBindGroup":(a,b,c,d)=>a.setBindGroup(b,c,d),"meth_call_4_draw":(a,b,c,d,e)=>a.draw(b,c,d,e),"meth_call_4_setIndexBuffer":(a,b,c,d,e)=>a.setIndexBuffer(b,c,d,e),"meth_call_4_setScissorRect":(a,b,c,d,e)=>a.setScissorRect(b,c,d,e),"meth_call_4_setVertexBuffer":(a,b,c,d,e)=>a.setVertexBuffer(b,c,d,e),"meth_call_4_writeTexture":(a,b,c,d,e)=>a.writeTexture(b,c,d,e),"meth_call_5_copyBufferToBuffer":(a,b,c,d,e,f)=>a.copyBufferToBuffer(b,c,d,e,f),"meth_call_5_drawIndexed":(a,b,c,d,e,f)=>a.drawIndexed(b,c,d,e,f),"meth_call_5_resolveQuerySet":(a,b,c,d,e,f)=>a.resolveQuerySet(b,c,d,e,f),"meth_call_5_setBindGroup":(a,b,c,d,e,f)=>a.setBindGroup(b,c,d,e,f),"meth_call_5_writeBuffer":(a,b,c,d,e,f)=>a.writeBuffer(b,c,d,e,f),"meth_call_6_setViewport":(a,b,c,d,e,f,g)=>a.setViewport(b,c,d,e,f,g),"obj_100":()=>({}),"obj_101":()=>({}),"obj_102":()=>({}),"obj_103":()=>({}),"obj_104":()=>({}),"obj_105":()=>({}),"obj_44":()=>({}),"obj_45":()=>({}),"obj_46":()=>({}),"obj_47":()=>({}),"obj_48":()=>({}),"obj_49":()=>({}),"obj_50":()=>({}),"obj_51":()=>({}),"obj_52":()=>({}),"obj_53":()=>({}),"obj_54":()=>({}),"obj_55":()=>({}),"obj_56":()=>({}),"obj_57":()=>({}),"obj_58":()=>({}),"obj_59":()=>({}),"obj_60":()=>({}),"obj_61":()=>({}),"obj_62":()=>({}),"obj_63":()=>({}),"obj_64":()=>({}),"obj_65":()=>({}),"obj_66":()=>({}),"obj_67":()=>({}),"obj_68":()=>({}),"obj_69":()=>({}),"obj_70":()=>({}),"obj_71":()=>({}),"obj_72":()=>({}),"obj_73":()=>({}),"obj_74":()=>({}),"obj_75":()=>({}),"obj_76":()=>({}),"obj_77":()=>({}),"obj_78":()=>({}),"obj_79":()=>({}),"obj_80":()=>({}),"obj_81":()=>({}),"obj_82":()=>({}),"obj_83":()=>({}),"obj_84":()=>({}),"obj_85":()=>({}),"obj_86":()=>({}),"obj_87":()=>({}),"obj_88":()=>({}),"obj_89":()=>({}),"obj_90":()=>({}),"obj_91":()=>({}),"obj_92":()=>({}),"obj_93":()=>({}),"obj_94":()=>({}),"obj_95":()=>({}),"obj_96":()=>({}),"obj_97":()=>({}),"obj_98":()=>({}),"obj_99":()=>({}),"set_attributes":(a,b)=>a.attributes=b,"set_bindGroupLayouts":(a,b)=>a.bindGroupLayouts=b,"set_buffer":(a,b)=>a.buffer=b,"set_buffers":(a,b)=>a.buffers=b,"set_colorAttachments":(a,b)=>a.colorAttachments=b,"set_colorFormats":(a,b)=>a.colorFormats=b,"set_compute":(a,b)=>a.compute=b,"set_constants":(a,b)=>a.constants=b,"set_device":(a,b)=>a.device=b,"set_entries":(a,b)=>a.entries=b,"set_format":(a,b)=>a.format=b,"set_hints":(a,b)=>a.hints=b,"set_layout":(a,b)=>a.layout=b,"set_module":(a,b)=>a.module=b,"set_origin":(a,b)=>a.origin=b,"set_querySet":(a,b)=>a.querySet=b,"set_resource":(a,b)=>a.resource=b,"set_size":(a,b)=>a.size=b,"set_source":(a,b)=>a.source=b,"set_targets":(a,b)=>a.targets=b,"set_texture":(a,b)=>a.texture=b,"set_timestampWrites":(a,b)=>a.timestampWrites=b,"set_vertex":(a,b)=>a.vertex=b,"set_view":(a,b)=>a.view=b,"set_viewFormats":(a,b)=>a.viewFormats=b},"Brr_webaudio.fragments":{"fun_call_2":(a,b,c)=>a(b,c),"get_AnalyserNode":a=>a.AnalyserNode,"get_AudioBuffer":a=>a.AudioBuffer,"get_AudioBufferSourceNode":a=>a.AudioBufferSourceNode,"get_AudioContext":a=>a.AudioContext,"get_AudioWorkletNode":a=>a.AudioWorkletNode,"get_BiquadFilterNode":a=>a.BiquadFilterNode,"get_ChannelMergerNode":a=>a.ChannelMergerNode,"get_ChannelSplitterNode":a=>a.ChannelSplitterNode,"get_ConstantSourceNode":a=>a.ConstantSourceNode,"get_ConvolverNode":a=>a.ConvolverNode,"get_DelayNode":a=>a.DelayNode,"get_DynamicsCompressorNode":a=>a.DynamicsCompressorNode,"get_GainNode":a=>a.GainNode,"get_IIRFilterNode":a=>a.IIRFilterNode,"get_MediaElementAudioSourceNode":a=>a.MediaElementAudioSourceNode,"get_MediaStreamAudioDestinationNode":a=>a.MediaStreamAudioDestinationNode,"get_MediaStreamAudioSourceNode":a=>a.MediaStreamAudioSourceNode,"get_OfflineAudioContext":a=>a.OfflineAudioContext,"get_OscillatorNode":a=>a.OscillatorNode,"get_PannerNode":a=>a.PannerNode,"get_PeriodicWave":a=>a.PeriodicWave,"get_StereoPannerNode":a=>a.StereoPannerNode,"get_WaveShaperNode":a=>a.WaveShaperNode,"get_attack":a=>a.attack,"get_audioWorklet":a=>a.audioWorklet,"get_context":a=>a.context,"get_curve":a=>a.curve,"get_delayTime":a=>a.delayTime,"get_destination":a=>a.destination,"get_detune":a=>a.detune,"get_gain":a=>a.gain,"get_knee":a=>a.knee,"get_listener":a=>a.listener,"get_mediaElement":a=>a.mediaElement,"get_mediaStream":a=>a.mediaStream,"get_offset":a=>a.offset,"get_orientationX":a=>a.orientationX,"get_orientationY":a=>a.orientationY,"get_orientationZ":a=>a.orientationZ,"get_pan":a=>a.pan,"get_parameters":a=>a.parameters,"get_playbackRate":a=>a.playbackRate,"get_port":a=>a.port,"get_positionX":a=>a.positionX,"get_positionY":a=>a.positionY,"get_positionZ":a=>a.positionZ,"get_ratio":a=>a.ratio,"get_registerProcessor":a=>a.registerProcessor,"get_release":a=>a.release,"get_stream":a=>a.stream,"get_threshold":a=>a.threshold,"meth_call_0_Q":a=>a.Q(),"meth_call_0_close":a=>a.close(),"meth_call_0_detune":a=>a.detune(),"meth_call_0_disconnect":a=>a.disconnect(),"meth_call_0_forwardX":a=>a.forwardX(),"meth_call_0_forwardY":a=>a.forwardY(),"meth_call_0_forwardZ":a=>a.forwardZ(),"meth_call_0_frequency":a=>a.frequency(),"meth_call_0_gain":a=>a.gain(),"meth_call_0_getOutputTimestamp":a=>a.getOutputTimestamp(),"meth_call_0_positionX":a=>a.positionX(),"meth_call_0_positionY":a=>a.positionY(),"meth_call_0_positionZ":a=>a.positionZ(),"meth_call_0_resume":a=>a.resume(),"meth_call_0_startRenderig":a=>a.startRenderig(),"meth_call_0_suspend":a=>a.suspend(),"meth_call_0_upX":a=>a.upX(),"meth_call_0_upY":a=>a.upY(),"meth_call_0_upZ":a=>a.upZ(),"meth_call_1_addModule":(a,b)=>a.addModule(b),"meth_call_1_cancelAndHoldAtTime":(a,b)=>a.cancelAndHoldAtTime(b),"meth_call_1_cancelScheduledValues":(a,b)=>a.cancelScheduledValues(b),"meth_call_1_decodeAudioData":(a,b)=>a.decodeAudioData(b),"meth_call_1_get":(a,b)=>a.get(b),"meth_call_1_getByteFrequencyData":(a,b)=>a.getByteFrequencyData(b),"meth_call_1_getByteTimeDomainData":(a,b)=>a.getByteTimeDomainData(b),"meth_call_1_getChannelData":(a,b)=>a.getChannelData(b),"meth_call_1_getFloatFrequencyData":(a,b)=>a.getFloatFrequencyData(b),"meth_call_1_getFloatTimeDomainData":(a,b)=>a.getFloatTimeDomainData(b),"meth_call_1_setPeriodicWave":(a,b)=>a.setPeriodicWave(b),"meth_call_1_start":(a,b)=>a.start(b),"meth_call_1_stop":(a,b)=>a.stop(b),"meth_call_1_suspend":(a,b)=>a.suspend(b),"meth_call_2_connect":(a,b,c)=>a.connect(b,c),"meth_call_2_disconnect":(a,b,c)=>a.disconnect(b,c),"meth_call_2_exponentialRampToValueAtTime":(a,b,c)=>a.exponentialRampToValueAtTime(b,c),"meth_call_2_linearRampToValueAtTime":(a,b,c)=>a.linearRampToValueAtTime(b,c),"meth_call_2_setValueAtTime":(a,b,c)=>a.setValueAtTime(b,c),"meth_call_3_connect":(a,b,c,d)=>a.connect(b,c,d),"meth_call_3_copyFromChannel":(a,b,c,d)=>a.copyFromChannel(b,c,d),"meth_call_3_copyToChannel":(a,b,c,d)=>a.copyToChannel(b,c,d),"meth_call_3_disconnect":(a,b,c,d)=>a.disconnect(b,c,d),"meth_call_3_getFrequencyResponse":(a,b,c,d)=>a.getFrequencyResponse(b,c,d),"meth_call_3_setTargetAtTime":(a,b,c,d)=>a.setTargetAtTime(b,c,d),"meth_call_3_setValueCurveAtTime":(a,b,c,d)=>a.setValueCurveAtTime(b,c,d),"meth_call_3_start":(a,b,c,d)=>a.start(b,c,d),"new_1":(a,b)=>new
a(b),"new_2":(a,b,c)=>new
a(b,c),"new_3":(a,b,c,d)=>new
a(b,c,d),"obj_106":()=>({}),"obj_107":(a,b,c)=>({numberOfChannels:a,length:b,sampleRate:c}),"obj_108":()=>({}),"obj_109":()=>({}),"obj_110":()=>({}),"obj_111":()=>({}),"obj_112":()=>({}),"obj_113":()=>({}),"obj_114":()=>({}),"obj_115":()=>({}),"obj_116":()=>({}),"obj_117":()=>({}),"obj_118":()=>({}),"obj_119":()=>({}),"obj_120":()=>({}),"obj_121":()=>({}),"obj_122":()=>({}),"obj_123":()=>({}),"obj_124":()=>({}),"obj_125":()=>({}),"obj_126":()=>({}),"obj_127":()=>({}),"obj_128":()=>({}),"obj_129":()=>({}),"obj_130":(a,b,c)=>({numberOfChannels:a,length:b,sampleRate:c}),"set_buffer":(a,b)=>a.buffer=b,"set_curve":(a,b)=>a.curve=b,"set_feedback":(a,b)=>a.feedback=b,"set_feedforward":(a,b)=>a.feedforward=b,"set_imag":(a,b)=>a.imag=b,"set_mediaElement":(a,b)=>a.mediaElement=b,"set_mediaStream":(a,b)=>a.mediaStream=b,"set_mediaStreamTrack":(a,b)=>a.mediaStreamTrack=b,"set_name":(a,b)=>a.name=b,"set_real":(a,b)=>a.real=b},"Brr_webcrypto.fragments":{"get_algorithm":a=>a.algorithm,"get_counter":a=>a.counter,"get_crypto":a=>a.crypto,"get_info":a=>a.info,"get_iv":a=>a.iv,"get_label":a=>a.label,"get_privateKey":a=>a.privateKey,"get_public":a=>a.public,"get_publicExponent":a=>a.publicExponent,"get_publicKey":a=>a.publicKey,"get_salt":a=>a.salt,"get_subtle":a=>a.subtle,"get_usages":a=>a.usages,"meth_call_1_getRandomValues":(a,b)=>a.getRandomValues(b),"meth_call_2_digest":(a,b,c)=>a.digest(b,c),"meth_call_2_exportKey":(a,b,c)=>a.exportKey(b,c),"meth_call_3_decrypt":(a,b,c,d)=>a.decrypt(b,c,d),"meth_call_3_deriveBits":(a,b,c,d)=>a.deriveBits(b,c,d),"meth_call_3_encrypt":(a,b,c,d)=>a.encrypt(b,c,d),"meth_call_3_generateKey":(a,b,c,d)=>a.generateKey(b,c,d),"meth_call_3_sign":(a,b,c,d)=>a.sign(b,c,d),"meth_call_4_verify":(a,b,c,d,e)=>a.verify(b,c,d,e),"meth_call_4_wrapKey":(a,b,c,d,e)=>a.wrapKey(b,c,d,e),"meth_call_5_deriveKey":(a,b,c,d,e,f)=>a.deriveKey(b,c,d,e,f),"meth_call_5_importKey":(a,b,c,d,e,f)=>a.importKey(b,c,d,e,f),"meth_call_7_unwrapKey":(a,b,c,d,e,f,g,h)=>a.unwrapKey(b,c,d,e,f,g,h),"obj_131":a=>({name:a}),"obj_132":(a,b,c,d)=>({name:a,modulusLength:b,publicExponent:c,hash:d}),"obj_133":(a,b)=>({name:a,hash:b}),"obj_134":(a,b)=>({name:a,saltLength:b}),"obj_135":(a,b)=>({name:a,label:b}),"obj_136":(a,b)=>({name:a,namedCurve:b}),"obj_137":(a,b)=>({name:a,namedCurve:b}),"obj_138":(a,b)=>({name:a,hash:b}),"obj_139":(a,b)=>({name:a,public:b}),"obj_140":(a,b)=>({name:a,length:b}),"obj_141":(a,b,c)=>({name:a,counter:b,length:c}),"obj_142":(a,b)=>({name:a,iv:b}),"obj_143":(a,b,c,d)=>({name:a,iv:b,additionalData:c,tagLength:d}),"obj_144":(a,b,c)=>({name:a,hash:b,length:c}),"obj_145":(a,b,c,d)=>({name:a,hash:b,salt:c,info:d}),"obj_146":(a,b,c,d)=>({name:a,hash:b,salt:c,iterations:d})},"Brr_webmidi.fragments":{"get_data":a=>a.data,"get_inputs":a=>a.inputs,"get_outputs":a=>a.outputs,"get_port":a=>a.port,"meth_call_0_clear":a=>a.clear(),"meth_call_0_close":a=>a.close(),"meth_call_0_open":a=>a.open(),"obj_147":()=>({})},"Brr_webworkers.fragments":{"get_SharedWorker":a=>a.SharedWorker,"get_Worker":a=>a.Worker,"get_active":a=>a.active,"get_ancestorOrigins":a=>a.ancestorOrigins,"get_clients":a=>a.clients,"get_controller":a=>a.controller,"get_installing":a=>a.installing,"get_navigationPreload":a=>a.navigationPreload,"get_port":a=>a.port,"get_ready":a=>a.ready,"get_registration":a=>a.registration,"get_scriptURL":a=>a.scriptURL,"get_serviceWorker":a=>a.serviceWorker,"get_state":a=>a.state,"get_waiting":a=>a.waiting,"meth_call_0_claim":a=>a.claim(),"meth_call_0_close":a=>a.close(),"meth_call_0_disable":a=>a.disable(),"meth_call_0_enable":a=>a.enable(),"meth_call_0_focus":a=>a.focus(),"meth_call_0_getRegistrations":a=>a.getRegistrations(),"meth_call_0_getState":a=>a.getState(),"meth_call_0_skipWaiting":a=>a.skipWaiting(),"meth_call_0_startMessages":a=>a.startMessages(),"meth_call_0_terminate":a=>a.terminate(),"meth_call_0_unregister":a=>a.unregister(),"meth_call_0_update":a=>a.update(),"meth_call_1_focus":(a,b)=>a.focus(b),"meth_call_1_get":(a,b)=>a.get(b),"meth_call_1_getNotifications":(a,b)=>a.getNotifications(b),"meth_call_1_getRegistration":(a,b)=>a.getRegistration(b),"meth_call_1_importScripts":(a,b)=>a.importScripts(b),"meth_call_1_matchAll":(a,b)=>a.matchAll(b),"meth_call_1_openWindow":(a,b)=>a.openWindow(b),"meth_call_1_setHeaderValue":(a,b)=>a.setHeaderValue(b),"meth_call_2_postMessage":(a,b,c)=>a.postMessage(b,c),"meth_call_2_register":(a,b,c)=>a.register(b,c),"meth_call_2_showNotification":(a,b,c)=>a.showNotification(b,c),"new_2":(a,b,c)=>new
a(b,c),"obj_148":a=>({tag:a}),"obj_149":()=>({}),"obj_150":()=>({})}}})(globalThis),"src":"main.bc.wasm.assets"});
