// @name         PPSSPP JIT Hooker
// @version      1.12.3-867+
// @author       [DC]
// @description  

const DoJitPtr = getDoJitAddress();
const buildRegs = createFunction_buildRegs();
const operations = Object.create(null);

// https://github.com/hrydgard/ppsspp/blob/714578a3ad7f9fa670a45281734166077341fa00/Core/MIPS/x86/Jit.cpp#L331
// const u8 *Jit::DoJit(
//    u32 em_address,
//    JitBlock *b
//    )
Interceptor.attach(DoJitPtr, {
    onEnter: function (args) {
        //const Jit_handle = args[0]; // rcx | rdi | x0
        this.em_address = args[1].toInt32(); // rdx | rsi | x1
    },
    onLeave: function (entrypoint) {
        const em_address = this.em_address;
        const op = operations[em_address];
        if (op !== undefined) {
            console.log('Attach:', ptr(em_address), entrypoint);
            Breakpoint.add(entrypoint, function () {
                const thiz = Object.create(null);
                thiz.context = Object.create(null);
                thiz.context.pc = em_address;
                const regs = buildRegs(this.context); // a0 a1 a2 ...

                op.call(thiz, regs);
            });
        }
    }
});

function getDoJitAddress() {
    if (Process.platform !== 'windows') {
        // Unix
        // not __ZN8MIPSComp10IRFrontend5DoJitEjRNSt3__16vectorI6IRInstNS1_9allocatorIS3_EEEERjb
        const names = [
            '_ZN8MIPSComp3Jit5DoJitEjP8JitBlock', // linux x64
            '__ZN8MIPSComp3Jit5DoJitEjP8JitBlock', // macOS x64
            '_ZN8MIPSComp8Arm64Jit5DoJitEjP8JitBlock', // android arm64
            '__ZN8MIPSComp8Arm64Jit5DoJitEjP8JitBlock' // macOS arm64
        ];
        for (const name of names) {
            const sym = DebugSymbol.fromName(name);
            if (sym.name !== null) {
                return sym.address;
            }
        }
    }
    else {
        // Windows MSVC x64
        // TODO: retroarch, DebugSymbol.fromName?
        const __e = Process.enumerateModules()[0];
        const DoJitSig1 = '48 89 5C 24 10 48 89 74 24 18 48 89 7C 24 20 55 41 54 41 55 41 56 41 57 48 8D AC 24 E0 F5 FF FF 48 81 EC 20 0B 00 00 48 8B 81 30 2A 00 00';
        const first = Memory.scanSync(__e.base, __e.size, DoJitSig1)[0];
        if (first) return first.address;
    }

    throw new Error('RegisterBlock not found!')
}

function createFunction_buildRegs() {
    let body = '';

    // https://github.com/hrydgard/ppsspp/blob/master/Core/MIPS/ARM/ArmRegCache.h
    // https://github.com/hrydgard/ppsspp/blob/master/Core/MIPS/ARM64/Arm64RegCache.h
    // https://github.com/hrydgard/ppsspp/blob/master/Core/MIPS/x86/RegCache.h

    const arch = Process.arch;
    if (arch === 'x64') {
        body += 'const base = context.rbx;'; // MEMBASEREG
        body += 'const regs = context.r14;'; // CTXREG
    }
    else if (arch === 'arm64') {
        body += 'const base = context.x28;';
        body += 'const regs = context.x27;';
    }
    else if (arch === 'arm') {
        body += 'const base = context.r11;';
        body += 'const regs = context.r10;';
    }
    else {
        throw new Error('CTXREG: ' + arch);
    }

    // mips: 0->3 (a0->a3)
    body += 'const args = [';
    for (let i = 0; i < 4; i++) {
        // https://github.com/hrydgard/ppsspp/blob/0c40e918c92b897f745abee0d09cf033a1572337/Core/MIPS/MIPS.h#L190
        let offset = -0x80 + 0x10 + i * 4; // skip: zero, at, v0, v1 = 0x10
        body += '{';
        body += `_vm: regs.add(${offset}).readU32(),`;
        body += `get value() { return base.add(this._vm); },`; // host address
        body += `set vm(val) { this._vm = val; },`;
        body += `get vm() { return this._vm },`;
        body += `save() {regs.add(${offset}).writeU32(this._vm); return this; }`
        body += '},';
    }
    body += '];'
    body += 'return args;';
    return new Function('context', body);
};

function setHook(object) {
    for (const key in object) {
        if (Object.hasOwnProperty.call(object, key)) {
            const element = object[key];
            operations[key] = element;
        }
    }
}

module.exports = exports = {
    setHook
}