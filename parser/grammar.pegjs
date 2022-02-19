{
  String.prototype.stripEscape = function(seq) { return this.replace(`\\${seq}`, seq); }

  function reduceArithmetic(head, tail) {
    return [head, ...tail].reduce((acc, val) => {
      if (acc == null) {
        return val;
      }

      const substitutions = {
        '||': 'or',
        '&&': 'and'
      }

      const operator = substitutions[val[1]] || val[1];
      const rightHandSide = val[3];

      return { [operator]: [acc, rightHandSide] }
    }, null)
  }
}


// Documents
Document
  = Operations

// Operations

Operations
  = _ head:Fork _ OperationDelimiter _ tail:Operations       { return [head, ...tail]; }
  / _ head:Fork _                                            { return [head];          }
  / _ head:Split _ OperationDelimiter _ tail:Operations      { return [head, ...tail]; }
  / _ head:Split _                                           { return head;            }
  / _ head:Operation _ OperationDelimiter _ tail:Operations  { return [head, ...tail]; }
  / _ head:Operation _ OperationDelimiter                    { return [head];          }
  / _ OperationDelimiter _                                   { return [];              }
  / _                                                        { return [];              }

Operation
  = op:Operator _req exps:Operands OperationDelimiter { return { operator: op, expressions: exps } }
  / op:Operator OperationDelimiter                    { return { operator: op, expressions: []   } }

Operator
  = '#' id:Identifier { return `#${id}` }
  / "!" id:Identifier { return `!${id}` }
  /     id:Identifier { return id }

Operands
  = _ exp:Expression _ "," _ tail:Operands { return [exp, ...tail] }
  / _ exp:Expression { return [ exp ]; }
OperationDelimiter
  = ';'
  / '\n'?

Split
  = _ '>>' doc:Document '<<' {
      return [
        { split: doc }
        // ,{ operator: 'mergeAll' }
      ]
    }

Fork
  = _ 'fork' _req type:Identifier _ '>>' _ body:ForkBody _ '<<' {
      return { fork: body, type: type }
  } 
  / _ 'fork' _req _ '>>' _ body:ForkBody _ '<<' {
      return { fork: body, type: "merge" }
  }

ForkBody
  = _ '(' _ head:Document _ ')' tail:ForkBody* { return [head, ...(tail.flat() || [])] }

// Expressions
Expression "expression"
  = ArithmeticExpression
  / FunctionCall
  / NonArithmeticExpression
  
NonArithmeticExpression
  = Object
  / Array
  / Boolean
  / Group
  / Numeric
  / VarIdentifier
  / ContextIdentifier
  / String
  / FunctionCall
  / Infinity
  / Null
  / Undefined

ArithmeticExpression = ArithmeticExpression9
ArithmeticExpression9
  = head:ArithmeticExpression8 tail:(_ '||' _ val:ArithmeticExpression8)+
    { return reduceArithmetic(head, tail); }
  / ArithmeticExpression8
ArithmeticExpression8
  = head:ArithmeticExpression7 tail:(_ '&&' _ val:ArithmeticExpression7)+
    { return reduceArithmetic(head, tail); }
  / ArithmeticExpression7
ArithmeticExpression7
  = head:ArithmeticExpression6 tail:(_ ('!==' / '!=' / '===' / '==') _ val:ArithmeticExpression6)+
    { return reduceArithmetic(head, tail); }
  / ArithmeticExpression6
ArithmeticExpression6
  = head:ArithmeticExpression5 tail:(_ ('<=' / '<' / '>' / '>=') _ val:ArithmeticExpression5)+
    { return reduceArithmetic(head, tail); }
  / ArithmeticExpression5
ArithmeticExpression5
  = head:ArithmeticExpression4 tail:(_ ('+' / '-') _ val:ArithmeticExpression4)+
    { return reduceArithmetic(head, tail); }
  / ArithmeticExpression4
ArithmeticExpression4
  = head:ArithmeticExpression3 tail:(_ '%' _ val:ArithmeticExpression3)+
    { return reduceArithmetic(head, tail); }
  / ArithmeticExpression3
ArithmeticExpression3
  = head:ArithmeticExpression2 tail:(_ ('*' / '/') _ val:ArithmeticExpression2)+
    { return reduceArithmetic(head, tail); }
  / ArithmeticExpression2
ArithmeticExpression2
  = head:ArithmeticExpression1 tail:(_ '**' _ val:ArithmeticExpression1)+
    { return reduceArithmetic(head, tail); }
  / ArithmeticExpression1
ArithmeticExpression1
  = op:('!' / '+' / '-') head:ArithmeticExpression0
    { return { [op]: head } }
  / ArithmeticExpression0
ArithmeticExpression0
  = _ "(" _ exp:Expression _ ")" { return exp; }
  / NonArithmeticExpression

FunctionCall
  = _ id:Identifier _ '(' _ args:FunctionArgs _ ')' {
    return { [id]: args.length <= 1 ? args[0] : args }
  }
FunctionArgs
  = head:Expression _ "," _ tail:(FunctionArgs) { return [head, ...tail]; }
  / head:Expression _ ","?                      { return [head]; }
  / _                                           { return []; }


// Literals
Object "object"
  = _ "{" _ body:(ObjectEntry*) _ "}" {
    return { obj: body.flat() }
  }
ObjectEntry "object-entry"
  = pair:ObjectEntryPair _ "," _ tail:(ObjectEntry) { return [ ...pair, ...tail ] }
  / pair:ObjectEntryPair _ ","?                     { return pair                 }
ObjectEntryPair
  = _ key:ObjectKey _ ":" _ val:Expression { return [key, val]; }
ObjectKey
  = Expression
  / Identifier

Array "array"
  = _ "[" _ body:(ArrayEntry*) _ "]" { return { list: body.flat() } }
ArrayEntry
  = value:Expression _ "," _ tail:(ArrayEntry) { return [value, ...tail] }
  / value:Expression _ ","?					   { return [value]          }


Identifier "identifier"
  = [a-zA-Z_.0-9]+ [a-zA-Z0-9_-]* { return text() }
  / '@' id:Identifier { return text() }
  / '$' id:Identifier { return text() }
VarIdentifier "@-identifier"
  = "@." id:MemberIdentifier { return { var: id } }
  / "@" { return { var: '' } }
ContextIdentifier "$-identifier"
  = '$.' id:MemberIdentifier { return { context: id } }
  / "$" { return { context: '' } }
MemberIdentifier "member-identifier"
  = Identifier
  / Integer { return text() }


String "string"
  = '"' value:(DoubleQuotedStringContents*) '"' { return value.join(''); }
  / "'" value:(SingleQuotedStringContents*) "'" { return value.join(''); }
DoubleQuotedStringContents
  = '\\"' { return text().stripEscape('"'); }
  / [^"]
SingleQuotedStringContents
  = "\\'" { return text().stripEscape("'") }
  / [^']

Boolean
  = 'true' { return true; }
  / 'false' { return false; }
  
Infinity = 'Infinity' { return Infinity }
Null = 'null' { return null }
Undefined = 'undefined' { return undefined }
Group = "@group" { return { "@group": [] } }

Numeric
  = _ [0-9]* "." [0-9]+ { return Number(text()) }
  / _ [0-9]+ "." [0-9]* { return Number(text()) }
  / Integer
Integer 'integer'
  = _ [0-9]+ { return Number(text()) }

// Whitespace
_req "required whitespace"
  = [ \t\n\r]+

_ "optional whitespace"
  = [ \t\n\r]*